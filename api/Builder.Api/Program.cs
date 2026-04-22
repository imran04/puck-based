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

    var page = await UpsertPage(
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

    var page = await UpsertPage(id, request, db, publish: false, compiler: null);
    return page is null
        ? Results.Conflict(new { error = "Slug is already used by another page" })
        : Results.Ok(PageDto.FromEntity(page));
});

app.MapPost("/api/pages/{id}/publish", async (string id, PublishPageRequest request, BuilderDbContext db, RazorCompiler compiler) =>
{
    if (request.Data.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        return Results.BadRequest(new { error = "Missing Puck data" });

    var page = await UpsertPage(id, request, db, publish: true, compiler: compiler);
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

static async Task<Page?> UpsertPage(
    string id,
    PublishPageRequest request,
    BuilderDbContext db,
    bool publish,
    RazorCompiler? compiler)
{
    var now = DateTimeOffset.UtcNow;
    var page = await db.Pages.FirstOrDefaultAsync(p => p.Id == id);
    var title = string.IsNullOrWhiteSpace(request.Title) ? "Puck Studio Page" : request.Title.Trim();
    var slug  = string.IsNullOrWhiteSpace(request.Slug) ? id : request.Slug.Trim();
    var rawData = request.Data.GetRawText();
    var slugConflict = await db.Pages.AsNoTracking().AnyAsync(p => p.Slug == slug && p.Id != id);

    if (slugConflict) return null;

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
                page.CompiledAssemblyBytes = result.AssemblyBytes;
        }
    }

    await db.SaveChangesAsync();
    return page;
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

    if (!doc.RootElement.TryGetProperty("dataSources", out var dsArray) ||
        dsArray.ValueKind != JsonValueKind.Array)
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
                .Select(r => (object?)JsonRowToDictionary(r.DataJson))
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
