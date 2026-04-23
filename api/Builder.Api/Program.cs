using System.Net;
using System.Text;
using System.Text.Json;
using Builder.Api.Data;
using Builder.Api.Models;
using Builder.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "BuilderStudio",
        policy => policy
            .WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

builder.Services.AddDbContext<BuilderDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("BuilderDb")));

builder.Services.AddSingleton<RazorCompiler>();
builder.Services.AddHttpClient();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

var app = builder.Build();

app.UseCors("BuilderStudio");

// ── Schema bootstrap ───────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BuilderDbContext>();
    await db.Database.EnsureCreatedAsync();

    // Add new columns to Pages table if upgrading from an older schema
    await db.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Pages' AND COLUMN_NAME = 'DataSourceMapJson'
        )
        BEGIN
            ALTER TABLE Pages ADD DataSourceMapJson nvarchar(max) NULL;
            ALTER TABLE Pages ADD RazorTemplate nvarchar(max) NULL;
            ALTER TABLE Pages ADD CompiledAssemblyBytes varbinary(max) NULL;
        END
        """);

    await db.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TableDefinitions')
        BEGIN
            CREATE TABLE TableDefinitions (
                Id uniqueidentifier NOT NULL PRIMARY KEY,
                Name nvarchar(128) NOT NULL,
                DisplayName nvarchar(256) NOT NULL,
                ColumnsJson nvarchar(max) NOT NULL,
                CreatedAt datetimeoffset NOT NULL,
                UpdatedAt datetimeoffset NOT NULL
            );
        END
        """);

    await db.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TableRelations')
        BEGIN
            CREATE TABLE TableRelations (
                Id uniqueidentifier NOT NULL PRIMARY KEY,
                FromTableId uniqueidentifier NOT NULL,
                ToTableId uniqueidentifier NOT NULL,
                RelationType nvarchar(32) NOT NULL,
                DisplayName nvarchar(256) NOT NULL,
                CreatedAt datetimeoffset NOT NULL,
                CONSTRAINT FK_TableRelations_From FOREIGN KEY (FromTableId) REFERENCES TableDefinitions(Id) ON DELETE CASCADE,
                CONSTRAINT FK_TableRelations_To FOREIGN KEY (ToTableId) REFERENCES TableDefinitions(Id) ON DELETE NO ACTION
            );
        END
        """);

    await db.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DynamicRows')
        BEGIN
            CREATE TABLE DynamicRows (
                Id uniqueidentifier NOT NULL PRIMARY KEY,
                TableId uniqueidentifier NOT NULL,
                DataJson nvarchar(max) NOT NULL,
                CreatedAt datetimeoffset NOT NULL,
                UpdatedAt datetimeoffset NOT NULL,
                CONSTRAINT FK_DynamicRows_Table FOREIGN KEY (TableId) REFERENCES TableDefinitions(Id) ON DELETE CASCADE
            );
            CREATE INDEX IX_DynamicRows_TableId_CreatedAt ON DynamicRows (TableId, CreatedAt DESC);
        END
        """);

    await db.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DynamicRelationRows')
        BEGIN
            CREATE TABLE DynamicRelationRows (
                Id uniqueidentifier NOT NULL PRIMARY KEY,
                RelationId uniqueidentifier NOT NULL,
                FromRowId uniqueidentifier NOT NULL,
                ToRowId uniqueidentifier NOT NULL,
                CONSTRAINT FK_DynamicRelationRows_Relation FOREIGN KEY (RelationId) REFERENCES TableRelations(Id) ON DELETE CASCADE
            );
            CREATE INDEX IX_DynRelRows_RelationId_FromRowId ON DynamicRelationRows (RelationId, FromRowId);
            CREATE INDEX IX_DynRelRows_RelationId_ToRowId ON DynamicRelationRows (RelationId, ToRowId);
        END
        """);

    await db.Database.ExecuteSqlRawAsync("""
        IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'FormSubmissions' AND COLUMN_NAME = 'PageId'
        )
        BEGIN
            ALTER TABLE FormSubmissions ADD PageId nvarchar(128) NULL;
            ALTER TABLE FormSubmissions ADD PageSlug nvarchar(256) NULL;
            ALTER TABLE FormSubmissions ADD FormId nvarchar(128) NULL;
            ALTER TABLE FormSubmissions ADD DynamicRowId uniqueidentifier NULL;
            ALTER TABLE FormSubmissions ADD RelayStatus nvarchar(64) NULL;
            ALTER TABLE FormSubmissions ADD RelayStatusCode int NULL;
        END
        """);
}

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// ── Pages ──────────────────────────────────────────────────────────────────

app.MapGet("/api/pages", async (BuilderDbContext db) =>
{
    var pages = await db.Pages
        .AsNoTracking()
        .OrderByDescending(p => p.UpdatedAt)
        .Select(p => PageDto.FromEntity(p))
        .ToListAsync();
    return Results.Ok(pages);
});

app.MapPost("/api/pages", async (CreatePageRequest request, BuilderDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.Id))
        return Results.BadRequest(new { error = "Page id is required" });

    if (request.Data.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        return Results.BadRequest(new { error = "Missing Puck data" });

    var pageId = SafePageId(request.Id);
    if (await db.Pages.AsNoTracking().AnyAsync(p => p.Id == pageId))
        return Results.Conflict(new { error = "Page already exists" });

    var (page, _) = await UpsertPage(
        pageId,
        new PublishPageRequest(request.Title, request.Slug ?? pageId, request.Data, null, null, null),
        db,
        publish: false,
        compiler: null);

    return page is null
        ? Results.Conflict(new { error = "Slug is already used by another page" })
        : Results.Created($"/api/pages/{page.Id}", PageDto.FromEntity(page));
});

app.MapGet("/api/pages/{id}", async (string id, BuilderDbContext db) =>
{
    var page = await db.Pages.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
    return page is null ? Results.NotFound(new { error = "Page not found" }) : Results.Ok(PageDto.FromEntity(page));
});

app.MapPut("/api/pages/{id}/draft", async (string id, PublishPageRequest request, BuilderDbContext db) =>
{
    if (request.Data.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        return Results.BadRequest(new { error = "Missing Puck data" });

    var (page, _) = await UpsertPage(id, request, db, publish: false, compiler: null);
    return page is null
        ? Results.Conflict(new { error = "Slug is already used by another page" })
        : Results.Ok(PageDto.FromEntity(page));
});

app.MapPost("/api/pages/{id}/publish", async (string id, PublishPageRequest request, BuilderDbContext db, RazorCompiler compiler) =>
{
    if (request.Data.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        return Results.BadRequest(new { error = "Missing Puck data" });

    if (string.IsNullOrWhiteSpace(request.CsharpSource))
        return Results.BadRequest(new { error = "Missing generated C# renderer source. Re-publish from the builder." });

    if (string.IsNullOrWhiteSpace(request.DataSourceMapJson))
        return Results.BadRequest(new { error = "Missing datasource map JSON. Re-publish from the builder." });

    var (page, compileError) = await UpsertPage(id, request, db, publish: true, compiler: compiler);
    if (!string.IsNullOrWhiteSpace(compileError))
        return Results.BadRequest(new { error = "Renderer compile failed", details = compileError });

    return page is null
        ? Results.Conflict(new { error = "Slug is already used by another page" })
        : Results.Ok(PageDto.FromEntity(page));
});

// ── Custom blocks ──────────────────────────────────────────────────────────

app.MapGet("/api/custom-blocks", async (string? kind, BuilderDbContext db) =>
{
    var query = db.CustomBlocks.AsNoTracking();
    if (!string.IsNullOrWhiteSpace(kind))
        query = query.Where(b => b.Kind == kind);

    var blocks = await query
        .OrderBy(b => b.Kind)
        .ThenBy(b => b.Name)
        .Select(b => CustomBlockDto.FromEntity(b))
        .ToListAsync();
    return Results.Ok(blocks);
});

app.MapGet("/api/custom-blocks/{id:guid}", async (Guid id, BuilderDbContext db) =>
{
    var block = await db.CustomBlocks.AsNoTracking().FirstOrDefaultAsync(b => b.Id == id);
    return block is null
        ? Results.NotFound(new { error = "Custom block not found" })
        : Results.Ok(CustomBlockDto.FromEntity(block));
});

app.MapPost("/api/custom-blocks", async (SaveCustomBlockRequest request, BuilderDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.Name))
        return Results.BadRequest(new { error = "Name is required" });
    if (request.Kind is not ("section" or "form"))
        return Results.BadRequest(new { error = "Kind must be section or form" });
    if (request.Data.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        return Results.BadRequest(new { error = "Missing component snapshot" });

    var now = DateTimeOffset.UtcNow;
    var block = new CustomBlock
    {
        Id = Guid.NewGuid(),
        Name = request.Name.Trim(),
        Kind = request.Kind,
        ComponentType = string.IsNullOrWhiteSpace(request.ComponentType) ? "Unknown" : request.ComponentType.Trim(),
        DataJson = request.Data.GetRawText(),
        CreatedAt = now,
        UpdatedAt = now,
    };
    db.CustomBlocks.Add(block);
    await db.SaveChangesAsync();
    return Results.Created($"/api/custom-blocks/{block.Id}", CustomBlockDto.FromEntity(block));
});

app.MapDelete("/api/custom-blocks/{id:guid}", async (Guid id, BuilderDbContext db) =>
{
    var block = await db.CustomBlocks.FindAsync(id);
    if (block is null)
        return Results.NotFound(new { error = "Custom block not found" });
    db.CustomBlocks.Remove(block);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// ── Form submissions ───────────────────────────────────────────────────────

app.MapPost("/api/form-submissions", async (SaveFormSubmissionRequest request, BuilderDbContext db) =>
{
    if (request.Payload.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        return Results.BadRequest(new { error = "Missing form payload" });

    var submission = new FormSubmission
    {
        Id = Guid.NewGuid(),
        FormTitle = string.IsNullOrWhiteSpace(request.FormTitle) ? "Form" : request.FormTitle.Trim(),
        PayloadJson = request.Payload.GetRawText(),
        CreatedAt = DateTimeOffset.UtcNow,
    };
    db.FormSubmissions.Add(submission);
    await db.SaveChangesAsync();
    return Results.Created($"/api/form-submissions/{submission.Id}", new
    {
        submission.Id,
        submission.FormTitle,
        submission.CreatedAt,
    });
});

app.MapPost("/api/forms/runtime-submit", async (
    HttpRequest request,
    BuilderDbContext db,
    IHttpClientFactory httpClientFactory) =>
{
    if (!request.HasFormContentType)
        return Results.BadRequest(new { error = "Expected form data" });

    var (fields, files, form) = await ReadSubmittedForm(request);
    var pageId = FormValue(form, "_pbPageId");
    var pageSlug = FormValue(form, "_pbPageSlug");
    var formId = FormValue(form, "_pbFormId");
    var formTitle = FormValue(form, "_pbFormTitle");

    if (string.IsNullOrWhiteSpace(pageId) && string.IsNullOrWhiteSpace(pageSlug))
        return Results.BadRequest(new { error = "Missing page identifier" });
    if (string.IsNullOrWhiteSpace(formId))
        return Results.BadRequest(new { error = "Missing form identifier" });

    var page = await db.Pages
        .AsNoTracking()
        .FirstOrDefaultAsync(p => p.Id == pageId || p.Slug == pageId || p.Slug == pageSlug);
    if (page is null)
        return Results.NotFound(new { error = "Page not found" });

    var pageJson = string.IsNullOrWhiteSpace(page.PublishedJson) ? page.DraftJson : page.PublishedJson;
    using var doc = JsonDocument.Parse(pageJson);
    if (!TryFindFormProps(doc.RootElement, formId, formTitle, out var formProps))
        return Results.BadRequest(new { error = "Form definition not found on this page" });

    var resolvedTitle = string.IsNullOrWhiteSpace(formTitle)
        ? GetString(formProps, "title", "Form")
        : formTitle;
    var dynamicRowId = await InsertFormDataSinkRow(formProps, fields, db);
    var relay = await RelayFormAsync(formProps, page, formId, fields, httpClientFactory, request);

    var payload = new
    {
        identifiers = new
        {
            pageId = page.Id,
            pageSlug = page.Slug,
            formId,
            formTitle = resolvedTitle,
        },
        fields,
        files,
        dataSink = new
        {
            dynamicRowId,
        },
        relay = new
        {
            status = relay.Status,
            statusCode = relay.StatusCode,
        },
    };

    var submission = new FormSubmission
    {
        Id = Guid.NewGuid(),
        PageId = page.Id,
        PageSlug = page.Slug,
        FormId = formId,
        FormTitle = resolvedTitle,
        PayloadJson = JsonSerializer.Serialize(payload, JsonOptions()),
        DynamicRowId = dynamicRowId,
        RelayStatus = relay.Status,
        RelayStatusCode = relay.StatusCode,
        CreatedAt = DateTimeOffset.UtcNow,
    };
    db.FormSubmissions.Add(submission);
    await db.SaveChangesAsync();

    var message = GetString(formProps, "successMessage", "Thanks. Your form submission was received.");
    var html = $"<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{WebUtility.HtmlEncode(resolvedTitle)}</title></head><body><main style=\"font-family:system-ui,sans-serif;max-width:680px;margin:12vh auto;padding:24px;\"><h1>{WebUtility.HtmlEncode(message)}</h1><p>Your response was saved.</p></main></body></html>";
    return Results.Content(html, "text/html; charset=utf-8");
});

app.MapGet("/api/forms/options", async (
    string pageId,
    string formId,
    string fieldName,
    string? parentValue,
    BuilderDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(pageId) ||
        string.IsNullOrWhiteSpace(formId) ||
        string.IsNullOrWhiteSpace(fieldName))
    {
        return Results.BadRequest(new { error = "pageId, formId, and fieldName are required" });
    }

    var page = await db.Pages
        .AsNoTracking()
        .FirstOrDefaultAsync(p => p.Id == pageId || p.Slug == pageId);
    if (page is null)
        return Results.NotFound(new { error = "Page not found" });

    var pageJson = string.IsNullOrWhiteSpace(page.PublishedJson) ? page.DraftJson : page.PublishedJson;
    using var doc = JsonDocument.Parse(pageJson);
    if (!TryFindFormProps(doc.RootElement, formId, "", out var formProps) ||
        !TryFindFormField(formProps, fieldName, out var field) ||
        !TryGetOptionSource(field, out var optionSource))
    {
        return Results.Ok(new { options = Array.Empty<object>() });
    }

    var options = await BuildSelectOptions(doc.RootElement, optionSource, parentValue, db);
    return Results.Ok(new { options });
});

// ── Dynamic Tables ─────────────────────────────────────────────────────────

app.MapGet("/api/tables", async (BuilderDbContext db) =>
{
    var tables = await db.TableDefinitions
        .AsNoTracking()
        .OrderBy(t => t.DisplayName)
        .Select(t => TableDto.FromEntity(t))
        .ToListAsync();
    return Results.Ok(tables);
});

app.MapPost("/api/tables", async (CreateTableRequest request, BuilderDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.Name))
        return Results.BadRequest(new { error = "Name is required" });

    var safeName = SafeName(request.Name);
    if (await db.TableDefinitions.AsNoTracking().AnyAsync(t => t.Name == safeName))
        return Results.Conflict(new { error = "A table with that name already exists" });

    var now = DateTimeOffset.UtcNow;
    var table = new TableDefinition
    {
        Id = Guid.NewGuid(),
        Name = safeName,
        DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? safeName : request.DisplayName.Trim(),
        ColumnsJson = request.Columns.ValueKind == JsonValueKind.Undefined ? "[]" : request.Columns.GetRawText(),
        CreatedAt = now,
        UpdatedAt = now,
    };
    db.TableDefinitions.Add(table);
    await db.SaveChangesAsync();
    return Results.Created($"/api/tables/{table.Id}", TableDto.FromEntity(table));
});

app.MapGet("/api/tables/{id:guid}", async (Guid id, BuilderDbContext db) =>
{
    var table = await db.TableDefinitions
        .AsNoTracking()
        .Include(t => t.RelationsFrom).ThenInclude(r => r.ToTable)
        .Include(t => t.RelationsTo).ThenInclude(r => r.FromTable)
        .FirstOrDefaultAsync(t => t.Id == id);

    if (table is null)
        return Results.NotFound(new { error = "Table not found" });

    var allRelations = table.RelationsFrom.Concat(table.RelationsTo).ToList();
    return Results.Ok(new TableWithRelationsDto(
        table.Id,
        table.Name,
        table.DisplayName,
        JsonSerializer.Deserialize<JsonElement>(table.ColumnsJson),
        allRelations.Select(RelationDto.FromEntity).ToList(),
        table.CreatedAt,
        table.UpdatedAt));
});

app.MapPut("/api/tables/{id:guid}", async (Guid id, UpdateTableRequest request, BuilderDbContext db) =>
{
    var table = await db.TableDefinitions.FindAsync(id);
    if (table is null)
        return Results.NotFound(new { error = "Table not found" });

    table.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? table.DisplayName : request.DisplayName.Trim();
    table.ColumnsJson = request.Columns.ValueKind == JsonValueKind.Undefined ? table.ColumnsJson : request.Columns.GetRawText();
    table.UpdatedAt = DateTimeOffset.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(TableDto.FromEntity(table));
});

app.MapDelete("/api/tables/{id:guid}", async (Guid id, BuilderDbContext db) =>
{
    var table = await db.TableDefinitions.FindAsync(id);
    if (table is null)
        return Results.NotFound(new { error = "Table not found" });
    db.TableDefinitions.Remove(table);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// ── Rows ───────────────────────────────────────────────────────────────────

app.MapGet("/api/tables/{tableId:guid}/rows", async (
    Guid tableId,
    string? filterField,
    string? filterOp,
    string? filterValue,
    int? limit,
    int? offset,
    BuilderDbContext db) =>
{
    if (!await db.TableDefinitions.AsNoTracking().AnyAsync(t => t.Id == tableId))
        return Results.NotFound(new { error = "Table not found" });

    var rows = await db.DynamicRows
        .AsNoTracking()
        .Where(r => r.TableId == tableId)
        .OrderByDescending(r => r.CreatedAt)
        .Skip(offset ?? 0)
        .Take(Math.Min(limit ?? 100, 500))
        .Select(r => DynamicRowDto.FromEntity(r))
        .ToListAsync();

    // Client-side field filter (simple eq/contains) – adequate for moderate volumes
    if (!string.IsNullOrWhiteSpace(filterField) && !string.IsNullOrWhiteSpace(filterValue))
    {
        rows = rows.Where(r =>
        {
            var data = r.Data;
            if (!data.TryGetProperty(filterField, out var prop)) return false;
            var val = prop.GetString() ?? prop.GetRawText();
            return filterOp switch
            {
                "contains" => val.Contains(filterValue, StringComparison.OrdinalIgnoreCase),
                "neq"      => !val.Equals(filterValue, StringComparison.OrdinalIgnoreCase),
                _          => val.Equals(filterValue, StringComparison.OrdinalIgnoreCase),
            };
        }).ToList();
    }

    return Results.Ok(rows);
});

app.MapPost("/api/tables/{tableId:guid}/rows", async (Guid tableId, SaveRowRequest request, BuilderDbContext db) =>
{
    if (!await db.TableDefinitions.AsNoTracking().AnyAsync(t => t.Id == tableId))
        return Results.NotFound(new { error = "Table not found" });

    if (request.Data.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        return Results.BadRequest(new { error = "Missing row data" });

    var now = DateTimeOffset.UtcNow;
    var row = new DynamicRow
    {
        Id = Guid.NewGuid(),
        TableId = tableId,
        DataJson = request.Data.GetRawText(),
        CreatedAt = now,
        UpdatedAt = now,
    };
    db.DynamicRows.Add(row);
    await db.SaveChangesAsync();
    return Results.Created($"/api/tables/{tableId}/rows/{row.Id}", DynamicRowDto.FromEntity(row));
});

app.MapGet("/api/tables/{tableId:guid}/rows/{rowId:guid}", async (Guid tableId, Guid rowId, BuilderDbContext db) =>
{
    var row = await db.DynamicRows.AsNoTracking()
        .FirstOrDefaultAsync(r => r.TableId == tableId && r.Id == rowId);
    return row is null
        ? Results.NotFound(new { error = "Row not found" })
        : Results.Ok(DynamicRowDto.FromEntity(row));
});

app.MapPut("/api/tables/{tableId:guid}/rows/{rowId:guid}", async (Guid tableId, Guid rowId, SaveRowRequest request, BuilderDbContext db) =>
{
    var row = await db.DynamicRows.FirstOrDefaultAsync(r => r.TableId == tableId && r.Id == rowId);
    if (row is null)
        return Results.NotFound(new { error = "Row not found" });
    if (request.Data.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        return Results.BadRequest(new { error = "Missing row data" });

    row.DataJson = request.Data.GetRawText();
    row.UpdatedAt = DateTimeOffset.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(DynamicRowDto.FromEntity(row));
});

app.MapDelete("/api/tables/{tableId:guid}/rows/{rowId:guid}", async (Guid tableId, Guid rowId, BuilderDbContext db) =>
{
    var row = await db.DynamicRows.FirstOrDefaultAsync(r => r.TableId == tableId && r.Id == rowId);
    if (row is null)
        return Results.NotFound(new { error = "Row not found" });
    db.DynamicRows.Remove(row);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// ── Relations ──────────────────────────────────────────────────────────────

app.MapGet("/api/tables/{tableId:guid}/relations", async (Guid tableId, BuilderDbContext db) =>
{
    var relations = await db.TableRelations
        .AsNoTracking()
        .Include(r => r.FromTable)
        .Include(r => r.ToTable)
        .Where(r => r.FromTableId == tableId || r.ToTableId == tableId)
        .Select(r => RelationDto.FromEntity(r))
        .ToListAsync();
    return Results.Ok(relations);
});

app.MapPost("/api/tables/{tableId:guid}/relations", async (Guid tableId, CreateRelationRequest request, BuilderDbContext db) =>
{
    if (!await db.TableDefinitions.AsNoTracking().AnyAsync(t => t.Id == tableId))
        return Results.NotFound(new { error = "Source table not found" });
    if (!await db.TableDefinitions.AsNoTracking().AnyAsync(t => t.Id == request.ToTableId))
        return Results.BadRequest(new { error = "Target table not found" });
    if (request.RelationType is not ("one_to_one" or "one_to_many" or "many_to_many"))
        return Results.BadRequest(new { error = "RelationType must be one_to_one, one_to_many, or many_to_many" });

    var relation = new TableRelation
    {
        Id = Guid.NewGuid(),
        FromTableId = tableId,
        ToTableId = request.ToTableId,
        RelationType = request.RelationType,
        DisplayName = request.DisplayName.Trim(),
        CreatedAt = DateTimeOffset.UtcNow,
    };
    db.TableRelations.Add(relation);
    await db.SaveChangesAsync();

    await db.Entry(relation).Reference(r => r.FromTable).LoadAsync();
    await db.Entry(relation).Reference(r => r.ToTable).LoadAsync();
    return Results.Created($"/api/relations/{relation.Id}", RelationDto.FromEntity(relation));
});

app.MapDelete("/api/relations/{id:guid}", async (Guid id, BuilderDbContext db) =>
{
    var relation = await db.TableRelations.FindAsync(id);
    if (relation is null)
        return Results.NotFound(new { error = "Relation not found" });
    db.TableRelations.Remove(relation);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Get related rows (one_to_many / many_to_many)
app.MapGet("/api/tables/{tableId:guid}/rows/{rowId:guid}/related/{relationId:guid}", async (
    Guid tableId, Guid rowId, Guid relationId, BuilderDbContext db) =>
{
    var relation = await db.TableRelations.AsNoTracking().FirstOrDefaultAsync(r => r.Id == relationId);
    if (relation is null)
        return Results.NotFound(new { error = "Relation not found" });

    IQueryable<DynamicRow> query;

    if (relation.RelationType == "many_to_many")
    {
        // Look up via junction rows
        var linkedIds = await db.DynamicRelationRows
            .AsNoTracking()
            .Where(jr => jr.RelationId == relationId && (jr.FromRowId == rowId || jr.ToRowId == rowId))
            .Select(jr => jr.FromRowId == rowId ? jr.ToRowId : jr.FromRowId)
            .ToListAsync();

        query = db.DynamicRows.AsNoTracking().Where(r => linkedIds.Contains(r.Id));
    }
    else
    {
        // For one_to_many, find rows in the target table that reference this row in their data
        var targetTableId = relation.FromTableId == tableId ? relation.ToTableId : relation.FromTableId;
        query = db.DynamicRows.AsNoTracking().Where(r => r.TableId == targetTableId);
    }

    var rows = await query.Select(r => DynamicRowDto.FromEntity(r)).ToListAsync();
    return Results.Ok(rows);
});

// Link two rows for a many_to_many relation
app.MapPost("/api/relations/{id:guid}/link", async (Guid id, LinkRowsRequest request, BuilderDbContext db) =>
{
    var relation = await db.TableRelations.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);
    if (relation is null)
        return Results.NotFound(new { error = "Relation not found" });

    var junction = new DynamicRelationRow
    {
        Id = Guid.NewGuid(),
        RelationId = id,
        FromRowId = request.FromRowId,
        ToRowId = request.ToRowId,
    };
    db.DynamicRelationRows.Add(junction);
    await db.SaveChangesAsync();
    return Results.Created($"/api/relations/{id}/link/{junction.Id}", junction);
});

// ── Render published page ──────────────────────────────────────────────────

app.MapGet("/api/pages/{id}/render", async (string id, BuilderDbContext db) =>
{
    var page = await db.Pages.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id || p.Slug == id);
    if (page is null)
        return Results.NotFound(new { error = "Page not found" });
    if (page.CompiledAssemblyBytes is null || page.CompiledAssemblyBytes.Length == 0)
        return Results.BadRequest(new { error = "Page has not been compiled yet. Publish the page first." });
    if (page.DataSourceMapJson is null)
        return Results.BadRequest(new { error = "No datasource map found. Re-publish the page." });

    var viewBag = await ResolveDataSources(page.DataSourceMapJson, db);
    var html = RazorCompiler.Render(page.CompiledAssemblyBytes, viewBag);
    return Results.Content(html, "text/html");
});

app.Run();

// ── Helpers ────────────────────────────────────────────────────────────────

static async Task<(Page? Page, string? CompileError)> UpsertPage(
    string id,
    PublishPageRequest request,
    BuilderDbContext db,
    bool publish,
    RazorCompiler? compiler)
{
    string? compileError = null;
    var now = DateTimeOffset.UtcNow;
    var page = await db.Pages.FirstOrDefaultAsync(p => p.Id == id);
    var title = string.IsNullOrWhiteSpace(request.Title) ? "Puck Studio Page" : request.Title.Trim();
    var slug  = string.IsNullOrWhiteSpace(request.Slug) ? id : request.Slug.Trim();
    var rawData = request.Data.GetRawText();
    var slugConflict = await db.Pages.AsNoTracking().AnyAsync(p => p.Slug == slug && p.Id != id);

    if (slugConflict) return (null, null);

    if (page is null)
    {
        page = new Page { Id = id, Title = title, Slug = slug, DraftJson = rawData, CreatedAt = now, UpdatedAt = now };
        db.Pages.Add(page);
    }
    else
    {
        page.Title = title;
        page.Slug  = slug;
        page.DraftJson = rawData;
        page.UpdatedAt = now;
    }

    if (publish)
    {
        page.PublishedJson = rawData;
        page.PublishedAt   = now;

        // Store datasource map
        if (!string.IsNullOrWhiteSpace(request.DataSourceMapJson))
            page.DataSourceMapJson = request.DataSourceMapJson;

        // Store Razor CSHTML artifact
        if (!string.IsNullOrWhiteSpace(request.RazorTemplate))
            page.RazorTemplate = request.RazorTemplate;

        // Compile and store C# renderer if source provided
        if (!string.IsNullOrWhiteSpace(request.CsharpSource) && compiler is not null)
        {
            var result = compiler.Compile(request.CsharpSource);
            if (result.Success)
            {
                page.CompiledAssemblyBytes = result.AssemblyBytes;
            }
            else
            {
                compileError = result.Error ?? "Unknown renderer compile failure.";
            }
        }
    }

    await db.SaveChangesAsync();
    return (page, compileError);
}

static string SafePageId(string value)
{
    var normalized = new string(
        value.Trim().ToLowerInvariant().Select(ch =>
            char.IsLetterOrDigit(ch) || ch is '-' or '_' ? ch : '-').ToArray());
    normalized = string.Join("-", normalized.Split('-', StringSplitOptions.RemoveEmptyEntries));
    return string.IsNullOrWhiteSpace(normalized) ? $"page-{Guid.NewGuid():N}" : normalized;
}

static string SafeName(string value)
{
    var normalized = new string(
        value.Trim().ToLowerInvariant().Select(ch =>
            char.IsLetterOrDigit(ch) || ch == '_' ? ch : '_').ToArray());
    normalized = string.Join("_", normalized.Split('_', StringSplitOptions.RemoveEmptyEntries));
    return string.IsNullOrWhiteSpace(normalized) ? $"table_{Guid.NewGuid():N}" : normalized;
}

static async Task<IReadOnlyDictionary<string, object?>> ResolveDataSources(
    string dataSourceMapJson,
    BuilderDbContext db)
{
    var result = new Dictionary<string, object?>();

    JsonDocument doc;
    try { doc = JsonDocument.Parse(dataSourceMapJson); }
    catch { return result; }

    if (!TryGetDisplaySourceArrayFromMap(doc.RootElement, out var dsArray))
        return result;

    foreach (var ds in dsArray.EnumerateArray())
    {
        var name      = ds.TryGetProperty("name",      out var n) ? n.GetString() ?? "" : "";
        var tableId   = ds.TryGetProperty("tableId",   out var t) ? t.GetString() ?? "" : "";
        var queryType = ds.TryGetProperty("queryType", out var q) ? q.GetString() ?? "single" : "single";
        var limit     = ds.TryGetProperty("limit",     out var l) ? (l.TryGetInt32(out var li) ? li : 100) : 100;
        var orderBy   = ds.TryGetProperty("orderBy",   out var ob) ? ob.GetString() : null;
        var orderDir  = ds.TryGetProperty("orderDir",  out var od) ? od.GetString() ?? "asc" : "asc";

        if (string.IsNullOrWhiteSpace(name) || !Guid.TryParse(tableId, out var tid))
            continue;

        var query = db.DynamicRows.AsNoTracking().Where(r => r.TableId == tid);

        // Load rows and apply in-memory filters
        var ordered = orderDir == "desc"
            ? query.OrderByDescending(r => r.CreatedAt)
            : query.OrderBy(r => r.CreatedAt);

        var allRows = await ordered.ToListAsync();

        if (ds.TryGetProperty("filters", out var filters) && filters.ValueKind == JsonValueKind.Array)
        {
            foreach (var f in filters.EnumerateArray())
            {
                var field = f.TryGetProperty("field", out var ff) ? ff.GetString() ?? "" : "";
                var op    = f.TryGetProperty("op",    out var fo) ? fo.GetString() ?? "eq" : "eq";
                var val   = f.TryGetProperty("value", out var fv) ? fv.GetString() ?? "" : "";
                if (string.IsNullOrWhiteSpace(field)) continue;

                allRows = allRows.Where(r =>
                {
                    try
                    {
                        using var rowDoc = JsonDocument.Parse(r.DataJson);
                        if (!rowDoc.RootElement.TryGetProperty(field, out var prop)) return false;
                        var propVal = prop.GetString() ?? prop.GetRawText();
                        return op switch
                        {
                            "contains" => propVal.Contains(val, StringComparison.OrdinalIgnoreCase),
                            "neq"      => !propVal.Equals(val, StringComparison.OrdinalIgnoreCase),
                            "gt"       => string.Compare(propVal, val, StringComparison.OrdinalIgnoreCase) > 0,
                            "lt"       => string.Compare(propVal, val, StringComparison.OrdinalIgnoreCase) < 0,
                            _          => propVal.Equals(val, StringComparison.OrdinalIgnoreCase),
                        };
                    }
                    catch { return false; }
                }).ToList();
            }
        }

        if (queryType == "single")
        {
            var firstRow = allRows.FirstOrDefault();
            result[name] = firstRow is null ? null : JsonRowToDictionary(firstRow.DataJson);
        }
        else
        {
            result[name] = allRows.Take(limit)
                .Select(r => JsonRowToDictionary(r.DataJson))
                .ToList();
        }
    }

    return result;
}

static IReadOnlyDictionary<string, object?> JsonRowToDictionary(string json)
{
    var dict = new Dictionary<string, object?>();
    try
    {
        using var doc = JsonDocument.Parse(json);
        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            dict[prop.Name] = prop.Value.ValueKind switch
            {
                JsonValueKind.String  => prop.Value.GetString(),
                JsonValueKind.Number  => prop.Value.GetDecimal().ToString(),
                JsonValueKind.True    => "true",
                JsonValueKind.False   => "false",
                _                    => prop.Value.GetRawText(),
            };
        }
    }
    catch { /* malformed JSON row — return empty dict */ }
    return dict;
}

static JsonSerializerOptions JsonOptions() => new(JsonSerializerDefaults.Web);

static async Task<(
    Dictionary<string, object?> Fields,
    List<Dictionary<string, object?>> Files,
    IFormCollection Form)> ReadSubmittedForm(HttpRequest request)
{
    var form = await request.ReadFormAsync();
    var fields = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

    foreach (var item in form)
    {
        if (item.Key.StartsWith("_pb", StringComparison.OrdinalIgnoreCase) ||
            item.Key.Equals("_formTitle", StringComparison.OrdinalIgnoreCase))
        {
            continue;
        }

        var key = NormalizeSubmittedFieldName(item.Key);
        fields[key] = item.Value.Count switch
        {
            0 => "",
            1 => item.Value[0] ?? "",
            _ => item.Value.ToArray(),
        };
    }

    var files = new List<Dictionary<string, object?>>();
    foreach (var file in form.Files)
    {
        files.Add(new Dictionary<string, object?>
        {
            ["fieldName"] = NormalizeSubmittedFieldName(file.Name),
            ["fileName"] = file.FileName,
            ["contentType"] = file.ContentType,
            ["length"] = file.Length,
        });

        var key = NormalizeSubmittedFieldName(file.Name);
        if (!fields.ContainsKey(key))
            fields[key] = file.FileName;
    }

    return (fields, files, form);
}

static string NormalizeSubmittedFieldName(string value) =>
    value.EndsWith("[]", StringComparison.Ordinal) ? value[..^2] : value;

static string FormValue(IFormCollection form, string key) =>
    form.TryGetValue(key, out var value) ? value.ToString() : "";

static string GetString(JsonElement element, string propertyName, string fallback = "")
{
    if (element.ValueKind != JsonValueKind.Object ||
        !element.TryGetProperty(propertyName, out var value))
    {
        return fallback;
    }

    return value.ValueKind switch
    {
        JsonValueKind.String => value.GetString() ?? fallback,
        JsonValueKind.Number => value.GetRawText(),
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        _ => fallback,
    };
}

static int GetInt(JsonElement element, string propertyName, int fallback)
{
    if (element.ValueKind == JsonValueKind.Object &&
        element.TryGetProperty(propertyName, out var value) &&
        value.TryGetInt32(out var parsed))
    {
        return parsed;
    }

    return fallback;
}

static string NormalizeName(string value, string fallback)
{
    var sb = new StringBuilder();
    var lastWasSeparator = false;

    foreach (var ch in value.Trim().ToLowerInvariant())
    {
        if (char.IsLetterOrDigit(ch))
        {
            sb.Append(ch);
            lastWasSeparator = false;
        }
        else if (!lastWasSeparator)
        {
            sb.Append('_');
            lastWasSeparator = true;
        }
    }

    var normalized = sb.ToString().Trim('_');
    return string.IsNullOrWhiteSpace(normalized) ? fallback : normalized;
}

static string FormDefinitionId(JsonElement props)
{
    var explicitId = GetString(props, "formId");
    if (string.IsNullOrWhiteSpace(explicitId))
        explicitId = GetString(props, "id");
    if (string.IsNullOrWhiteSpace(explicitId))
        explicitId = GetString(props, "title", "form");

    return NormalizeName(explicitId, "form");
}

static bool TryFindFormProps(
    JsonElement node,
    string formId,
    string formTitle,
    out JsonElement props)
{
    props = default;

    if (node.ValueKind == JsonValueKind.Object)
    {
        if (GetString(node, "type") == "FormBlock" &&
            node.TryGetProperty("props", out var candidateProps))
        {
            var normalizedWanted = NormalizeName(formId, "form");
            var normalizedCandidate = FormDefinitionId(candidateProps);
            var candidateTitle = GetString(candidateProps, "title");

            if (normalizedCandidate.Equals(normalizedWanted, StringComparison.OrdinalIgnoreCase) ||
                (!string.IsNullOrWhiteSpace(formTitle) &&
                 candidateTitle.Equals(formTitle, StringComparison.OrdinalIgnoreCase)))
            {
                props = candidateProps;
                return true;
            }
        }

        foreach (var property in node.EnumerateObject())
        {
            if (TryFindFormProps(property.Value, formId, formTitle, out props))
                return true;
        }
    }

    if (node.ValueKind == JsonValueKind.Array)
    {
        foreach (var item in node.EnumerateArray())
        {
            if (TryFindFormProps(item, formId, formTitle, out props))
                return true;
        }
    }

    return false;
}

static bool TryFindFormField(JsonElement formProps, string fieldName, out JsonElement field)
{
    field = default;

    if (!formProps.TryGetProperty("fields", out var fields) ||
        fields.ValueKind != JsonValueKind.Array)
    {
        return false;
    }

    var wanted = NormalizeName(fieldName, "field");
    var index = 0;
    foreach (var candidate in fields.EnumerateArray())
    {
        var name = GetString(candidate, "name");
        if (string.IsNullOrWhiteSpace(name))
            name = GetString(candidate, "label");

        var normalized = NormalizeName(name, $"field_{index + 1}");
        if (normalized.Equals(wanted, StringComparison.OrdinalIgnoreCase))
        {
            field = candidate;
            return true;
        }

        index++;
    }

    return false;
}

static bool TryGetOptionSource(JsonElement field, out JsonElement optionSource)
{
    optionSource = default;

    if (field.TryGetProperty("optionSource", out var source) &&
        source.ValueKind == JsonValueKind.Object &&
        !string.IsNullOrWhiteSpace(GetString(source, "source")) &&
        !string.IsNullOrWhiteSpace(GetString(source, "tableId")) &&
        !string.IsNullOrWhiteSpace(GetString(source, "valueField")) &&
        !string.IsNullOrWhiteSpace(GetString(source, "labelField")))
    {
        optionSource = source;
        return true;
    }

    return false;
}

static bool TryGetDataSink(JsonElement formProps, out JsonElement sink)
{
    sink = default;

    if (formProps.TryGetProperty("dataSink", out var dataSink) &&
        dataSink.ValueKind == JsonValueKind.Object &&
        !string.IsNullOrWhiteSpace(GetString(dataSink, "tableId")))
    {
        sink = dataSink;
        return true;
    }

    return false;
}

static async Task<Guid?> InsertFormDataSinkRow(
    JsonElement formProps,
    Dictionary<string, object?> fields,
    BuilderDbContext db)
{
    if (!TryGetDataSink(formProps, out var sink) ||
        !Guid.TryParse(GetString(sink, "tableId"), out var tableId))
    {
        return null;
    }

    var table = await db.TableDefinitions.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tableId);
    if (table is null)
        return null;

    var columns = ReadColumnNames(table.ColumnsJson);
    var rowData = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

    foreach (var mapping in ReadSinkMappings(formProps, sink))
    {
        if (!ColumnAllowed(columns, mapping.TableColumn))
            continue;

        if (fields.TryGetValue(mapping.FormField, out var value))
            rowData[mapping.TableColumn] = value;
    }

    foreach (var column in columns)
    {
        if (!rowData.ContainsKey(column) && fields.TryGetValue(column, out var value))
            rowData[column] = value;
    }

    // Always keep a full submission snapshot in the dynamic row JSON.
    rowData["_pbSubmission"] = fields;
    rowData["_pbCapturedAt"] = DateTimeOffset.UtcNow.ToString("O");
    rowData["_pbSinkSource"] = GetString(sink, "source", tableId.ToString());

    var now = DateTimeOffset.UtcNow;
    var row = new DynamicRow
    {
        Id = Guid.NewGuid(),
        TableId = tableId,
        DataJson = JsonSerializer.Serialize(rowData, JsonOptions()),
        CreatedAt = now,
        UpdatedAt = now,
    };

    db.DynamicRows.Add(row);
    await db.SaveChangesAsync();
    return row.Id;
}

static bool ColumnAllowed(HashSet<string> columns, string column) =>
    columns.Count == 0 || columns.Contains(column);

static IEnumerable<(string FormField, string TableColumn)> ReadSinkMappings(
    JsonElement formProps,
    JsonElement sink)
{
    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    foreach (var mapping in ReadFieldLevelSinkMappings(formProps))
    {
        var key = $"{mapping.FormField}\u001f{mapping.TableColumn}";
        if (seen.Add(key))
            yield return mapping;
    }

    foreach (var mapping in ReadLegacyFieldMappings(sink))
    {
        var key = $"{mapping.FormField}\u001f{mapping.TableColumn}";
        if (seen.Add(key))
            yield return mapping;
    }
}

static IEnumerable<(string FormField, string TableColumn)> ReadFieldLevelSinkMappings(
    JsonElement formProps)
{
    if (!formProps.TryGetProperty("fields", out var fieldsArray) ||
        fieldsArray.ValueKind != JsonValueKind.Array)
    {
        yield break;
    }

    var index = 0;
    foreach (var field in fieldsArray.EnumerateArray())
    {
        var fieldType = GetString(field, "type");
        if (IsLayoutOnlyFieldType(fieldType))
        {
            index++;
            continue;
        }

        var sinkColumn = GetString(field, "sinkColumn");
        if (string.IsNullOrWhiteSpace(sinkColumn))
        {
            index++;
            continue;
        }

        var rawName = GetString(field, "name");
        if (string.IsNullOrWhiteSpace(rawName))
            rawName = GetString(field, "label");

        var formField = NormalizeName(rawName, $"field_{index + 1}");
        if (!string.IsNullOrWhiteSpace(formField))
            yield return (formField, sinkColumn);

        index++;
    }
}

static bool IsLayoutOnlyFieldType(string fieldType) =>
    fieldType.Equals("heading", StringComparison.OrdinalIgnoreCase) ||
    fieldType.Equals("paragraph", StringComparison.OrdinalIgnoreCase) ||
    fieldType.Equals("divider", StringComparison.OrdinalIgnoreCase);

static IEnumerable<(string FormField, string TableColumn)> ReadLegacyFieldMappings(JsonElement sink)
{
    if (!sink.TryGetProperty("fieldMappings", out var mappings) ||
        mappings.ValueKind != JsonValueKind.Array)
    {
        yield break;
    }

    foreach (var mapping in mappings.EnumerateArray())
    {
        var formField = NormalizeName(GetString(mapping, "formField"), "");
        var tableColumn = GetString(mapping, "tableColumn");

        if (!string.IsNullOrWhiteSpace(formField) &&
            !string.IsNullOrWhiteSpace(tableColumn))
        {
            yield return (formField, tableColumn);
        }
    }
}

static HashSet<string> ReadColumnNames(string columnsJson)
{
    var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    try
    {
        using var doc = JsonDocument.Parse(columnsJson);
        if (doc.RootElement.ValueKind != JsonValueKind.Array)
            return columns;

        foreach (var column in doc.RootElement.EnumerateArray())
        {
            var name = column.ValueKind == JsonValueKind.String
                ? column.GetString() ?? ""
                : GetString(column, "name");
            if (!string.IsNullOrWhiteSpace(name))
                columns.Add(name);
        }
    }
    catch
    {
        return columns;
    }

    return columns;
}

static async Task<(string? Status, int? StatusCode)> RelayFormAsync(
    JsonElement formProps,
    Page page,
    string formId,
    Dictionary<string, object?> fields,
    IHttpClientFactory httpClientFactory,
    HttpRequest request)
{
    var actionUrl = GetString(formProps, "actionUrl");
    if (string.IsNullOrWhiteSpace(actionUrl))
        return (null, null);

    Uri uri;
    if (Uri.TryCreate(actionUrl, UriKind.Absolute, out var absoluteUri))
    {
        if (absoluteUri.Scheme != Uri.UriSchemeHttp && absoluteUri.Scheme != Uri.UriSchemeHttps)
            return ("invalid-url", null);

        uri = absoluteUri;
    }
    else if (actionUrl.StartsWith("/", StringComparison.Ordinal))
    {
        uri = new Uri(new Uri($"{request.Scheme}://{request.Host}"), actionUrl);
    }
    else
    {
        return ("invalid-url", null);
    }

    if (uri.AbsolutePath.Equals("/api/forms/runtime-submit", StringComparison.OrdinalIgnoreCase))
        return ("skipped-loop", null);

    var relayFields = FlattenRelayFields(fields);
    relayFields.Add(new KeyValuePair<string, string>("_pbPageId", page.Id));
    relayFields.Add(new KeyValuePair<string, string>("_pbPageSlug", page.Slug));
    relayFields.Add(new KeyValuePair<string, string>("_pbFormId", formId));

    try
    {
        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(10);
        var method = GetString(formProps, "relayMethod", "post");
        HttpResponseMessage response;

        if (method.Equals("get", StringComparison.OrdinalIgnoreCase))
        {
            response = await client.GetAsync(AppendQuery(uri, relayFields));
        }
        else
        {
            response = await client.PostAsync(uri, new FormUrlEncodedContent(relayFields));
        }

        return (response.IsSuccessStatusCode ? "success" : "http-error", (int)response.StatusCode);
    }
    catch
    {
        return ("failed", null);
    }
}

static List<KeyValuePair<string, string>> FlattenRelayFields(Dictionary<string, object?> fields)
{
    var output = new List<KeyValuePair<string, string>>();

    foreach (var (key, value) in fields)
    {
        switch (value)
        {
            case string[] many:
                output.AddRange(many.Select(item => new KeyValuePair<string, string>(key, item)));
                break;
            case IEnumerable<string> many:
                output.AddRange(many.Select(item => new KeyValuePair<string, string>(key, item)));
                break;
            case null:
                output.Add(new KeyValuePair<string, string>(key, ""));
                break;
            default:
                output.Add(new KeyValuePair<string, string>(key, value.ToString() ?? ""));
                break;
        }
    }

    return output;
}

static Uri AppendQuery(Uri uri, IEnumerable<KeyValuePair<string, string>> fields)
{
    var builder = new UriBuilder(uri);
    var existing = builder.Query.TrimStart('?');
    var next = string.Join("&", fields.Select(pair =>
        $"{WebUtility.UrlEncode(pair.Key)}={WebUtility.UrlEncode(pair.Value)}"));

    builder.Query = string.IsNullOrWhiteSpace(existing)
        ? next
        : $"{existing}&{next}";

    return builder.Uri;
}

static async Task<List<Dictionary<string, string>>> BuildSelectOptions(
    JsonElement pageData,
    JsonElement optionSource,
    string? parentValue,
    BuilderDbContext db)
{
    var sourceName = GetString(optionSource, "source");
    var fallbackTableId = GetString(optionSource, "tableId");
    var valueField = GetString(optionSource, "valueField");
    var labelField = GetString(optionSource, "labelField", valueField);
    var rows = await ResolveOptionRows(pageData, sourceName, fallbackTableId, db);

    if (optionSource.TryGetProperty("cascade", out var cascade) &&
        cascade.ValueKind == JsonValueKind.Object)
    {
        var parentColumn = GetString(cascade, "parentValueColumn");
        if (!string.IsNullOrWhiteSpace(parentColumn))
        {
            if (string.IsNullOrWhiteSpace(parentValue))
                return [];

            rows = rows
                .Where(row => DictValue(row, parentColumn).Equals(parentValue, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
    }

    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var options = new List<Dictionary<string, string>>();
    foreach (var row in rows)
    {
        var value = DictValue(row, valueField);
        if (string.IsNullOrWhiteSpace(value))
            continue;

        var label = DictValue(row, labelField);
        if (string.IsNullOrWhiteSpace(label))
            label = value;

        var key = $"{value}\u001f{label}";
        if (!seen.Add(key))
            continue;

        options.Add(new Dictionary<string, string>
        {
            ["value"] = value,
            ["label"] = label,
        });
    }

    return options;
}

static async Task<List<IReadOnlyDictionary<string, object?>>> ResolveOptionRows(
    JsonElement pageData,
    string sourceName,
    string fallbackTableId,
    BuilderDbContext db)
{
    JsonElement? dataSource = TryFindDataSource(pageData, sourceName, out var found)
        ? found
        : null;

    var tableIdText = dataSource.HasValue
        ? GetString(dataSource.Value, "tableId", fallbackTableId)
        : fallbackTableId;
    if (!Guid.TryParse(tableIdText, out var tableId))
        return [];

    var orderDir = dataSource.HasValue ? GetString(dataSource.Value, "orderDir", "asc") : "asc";
    var limit = dataSource.HasValue ? GetInt(dataSource.Value, "limit", 500) : 500;
    limit = Math.Clamp(limit <= 0 ? 500 : limit, 1, 1000);

    var query = db.DynamicRows.AsNoTracking().Where(r => r.TableId == tableId);
    var rows = await (orderDir.Equals("desc", StringComparison.OrdinalIgnoreCase)
        ? query.OrderByDescending(r => r.CreatedAt)
        : query.OrderBy(r => r.CreatedAt)).ToListAsync();

    if (dataSource.HasValue &&
        dataSource.Value.TryGetProperty("filters", out var filters) &&
        filters.ValueKind == JsonValueKind.Array)
    {
        rows = ApplyDataSourceFilters(rows, filters);
    }

    return rows
        .Take(limit)
        .Select(row => JsonRowToDictionary(row.DataJson))
        .ToList();
}

static bool TryGetDisplaySourceArrayFromMap(JsonElement mapRoot, out JsonElement sources)
{
    sources = default;

    if (mapRoot.TryGetProperty("displaySources", out sources) &&
        sources.ValueKind == JsonValueKind.Array)
    {
        return true;
    }

    if (mapRoot.TryGetProperty("dataSources", out sources) &&
        sources.ValueKind == JsonValueKind.Array)
    {
        return true;
    }

    return false;
}

static bool TryGetDisplaySourceArrayFromPage(JsonElement pageData, out JsonElement sources)
{
    sources = default;

    if (!pageData.TryGetProperty("root", out var root) ||
        !root.TryGetProperty("props", out var props) ||
        props.ValueKind != JsonValueKind.Object)
    {
        return false;
    }

    if (props.TryGetProperty("displaySources", out sources) &&
        sources.ValueKind == JsonValueKind.Array)
    {
        return true;
    }

    if (props.TryGetProperty("dataSources", out sources) &&
        sources.ValueKind == JsonValueKind.Array)
    {
        return true;
    }

    return false;
}

static bool TryFindDataSource(JsonElement pageData, string sourceName, out JsonElement dataSource)
{
    dataSource = default;

    if (string.IsNullOrWhiteSpace(sourceName) ||
        !TryGetDisplaySourceArrayFromPage(pageData, out var dataSources))
    {
        return false;
    }

    foreach (var candidate in dataSources.EnumerateArray())
    {
        if (GetString(candidate, "name").Equals(sourceName, StringComparison.OrdinalIgnoreCase))
        {
            dataSource = candidate;
            return true;
        }
    }

    return false;
}

static List<DynamicRow> ApplyDataSourceFilters(List<DynamicRow> rows, JsonElement filters)
{
    foreach (var filter in filters.EnumerateArray())
    {
        var field = GetString(filter, "field");
        var op = GetString(filter, "op", "eq");
        var value = GetString(filter, "value");
        if (string.IsNullOrWhiteSpace(field))
            continue;

        rows = rows.Where(row =>
        {
            var rowData = JsonRowToDictionary(row.DataJson);
            var actual = DictValue(rowData, field);

            return op switch
            {
                "contains" => actual.Contains(value, StringComparison.OrdinalIgnoreCase),
                "neq" => !actual.Equals(value, StringComparison.OrdinalIgnoreCase),
                "gt" => string.Compare(actual, value, StringComparison.OrdinalIgnoreCase) > 0,
                "lt" => string.Compare(actual, value, StringComparison.OrdinalIgnoreCase) < 0,
                _ => actual.Equals(value, StringComparison.OrdinalIgnoreCase),
            };
        }).ToList();
    }

    return rows;
}

static string DictValue(IReadOnlyDictionary<string, object?> row, string field)
{
    if (row.TryGetValue(field, out var exact))
        return exact?.ToString() ?? "";

    var fallback = row.FirstOrDefault(entry =>
        entry.Key.Equals(field, StringComparison.OrdinalIgnoreCase));
    return fallback.Key is null ? "" : fallback.Value?.ToString() ?? "";
}
