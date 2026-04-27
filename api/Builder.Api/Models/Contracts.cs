using System.Text.Json;

namespace Builder.Api.Models;

public sealed record SavePageRequest(
    string? Title,
    string? Slug,
    JsonElement Data);

public sealed record CreatePageRequest(
    string Id,
    string? Title,
    string? Slug,
    JsonElement Data);

public sealed record PageDto(
    string Id,
    string Title,
    string Slug,
    JsonElement Draft,
    JsonElement? Published,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? PublishedAt,
    string Status,
    bool IsCompiled)
{
    public static PageDto FromEntity(Page page) => new(
        page.Id,
        page.Title,
        page.Slug,
        JsonSerializer.Deserialize<JsonElement>(page.DraftJson),
        string.IsNullOrWhiteSpace(page.PublishedJson)
            ? null
            : JsonSerializer.Deserialize<JsonElement>(page.PublishedJson),
        page.CreatedAt,
        page.UpdatedAt,
        page.PublishedAt,
        page.Status.ToString().ToLowerInvariant(),
        page.IsCompiled);
}

public sealed record SaveCustomBlockRequest(
    string Name,
    string Kind,
    string ComponentType,
    JsonElement Data);

public sealed record CustomBlockDto(
    Guid Id,
    string Name,
    string Kind,
    string ComponentType,
    JsonElement Data,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static CustomBlockDto FromEntity(CustomBlock block) => new(
        block.Id,
        block.Name,
        block.Kind,
        block.ComponentType,
        JsonSerializer.Deserialize<JsonElement>(block.DataJson),
        block.CreatedAt,
        block.UpdatedAt);
}

public sealed record SaveFormSubmissionRequest(string FormTitle, JsonElement Payload);

// ── Dynamic Tables ──────────────────────────────────────────────────────────

public sealed record CreateTableRequest(string Name, string DisplayName, JsonElement Columns);

public sealed record UpdateTableRequest(string DisplayName, JsonElement Columns);

public sealed record TableDto(
    Guid Id,
    string Name,
    string DisplayName,
    JsonElement Columns,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static TableDto FromEntity(TableDefinition t) => new(
        t.Id,
        t.Name,
        t.DisplayName,
        JsonSerializer.Deserialize<JsonElement>(t.ColumnsJson),
        t.CreatedAt,
        t.UpdatedAt);
}

public sealed record TableWithRelationsDto(
    Guid Id,
    string Name,
    string DisplayName,
    JsonElement Columns,
    List<RelationDto> Relations,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

// ── Dynamic Rows ────────────────────────────────────────────────────────────

public sealed record SaveRowRequest(JsonElement Data);

public sealed record DynamicRowDto(
    Guid Id,
    Guid TableId,
    JsonElement Data,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static DynamicRowDto FromEntity(DynamicRow r) => new(
        r.Id,
        r.TableId,
        JsonSerializer.Deserialize<JsonElement>(r.DataJson),
        r.CreatedAt,
        r.UpdatedAt);
}

// ── Relations ───────────────────────────────────────────────────────────────

public sealed record CreateRelationRequest(
    Guid ToTableId,
    string RelationType,
    string DisplayName);

public sealed record RelationDto(
    Guid Id,
    Guid FromTableId,
    string FromTableName,
    Guid ToTableId,
    string ToTableName,
    string RelationType,
    string DisplayName,
    DateTimeOffset CreatedAt)
{
    public static RelationDto FromEntity(TableRelation r) => new(
        r.Id,
        r.FromTableId,
        r.FromTable?.DisplayName ?? "",
        r.ToTableId,
        r.ToTable?.DisplayName ?? "",
        r.RelationType,
        r.DisplayName,
        r.CreatedAt);
}

public sealed record LinkRowsRequest(Guid FromRowId, Guid ToRowId);

// ── Compile / Render ─────────────────────────────────────────────────────────

public sealed record CompilePageRequest(
    string RazorTemplate,
    string DataSourceMapJson,
    string CsharpSource);

public sealed record CompilePageResponse(
    bool Success,
    string? Error,
    DateTimeOffset? CompiledAt);

public sealed record PublishPageRequest(
    string? Title,
    string? Slug,
    JsonElement Data,
    string? DataSourceMapJson,
    string? RazorTemplate,
    string? CsharpSource);

public sealed record UpdatePageStatusRequest(string Status);

public sealed record AdminLoginRequest(string? Username, string? Password);

// ── Media ───────────────────────────────────────────────────────────────────

public sealed record UpdateMediaAssetRequest(
    string? AltText,
    string? Caption,
    string[]? Tags);

public sealed record MediaAssetDto(
    Guid Id,
    string OriginalFileName,
    string StoredFileName,
    string RelativePath,
    string MimeType,
    long SizeBytes,
    int? Width,
    int? Height,
    string? HashSha256,
    string? AltText,
    string? Caption,
    string[] Tags,
    string Url,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static MediaAssetDto FromEntity(MediaAsset asset) => new(
        asset.Id,
        asset.OriginalFileName,
        asset.StoredFileName,
        asset.RelativePath,
        asset.MimeType,
        asset.SizeBytes,
        asset.Width,
        asset.Height,
        asset.HashSha256,
        asset.AltText,
        asset.Caption,
        ParseTags(asset.TagsJson),
        $"/media/{asset.Id:D}",
        asset.CreatedAt,
        asset.UpdatedAt);

    private static string[] ParseTags(string? tagsJson)
    {
        if (string.IsNullOrWhiteSpace(tagsJson))
            return [];

        try
        {
            return JsonSerializer.Deserialize<string[]>(tagsJson) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
