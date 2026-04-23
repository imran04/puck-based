namespace Builder.Api.Models;

public sealed class MediaAsset
{
    public Guid Id { get; set; }

    public string OriginalFileName { get; set; } = "";

    public string StoredFileName { get; set; } = "";

    public string RelativePath { get; set; } = "";

    public string MimeType { get; set; } = "";

    public long SizeBytes { get; set; }

    public int? Width { get; set; }

    public int? Height { get; set; }

    public string? HashSha256 { get; set; }

    public string? AltText { get; set; }

    public string? Caption { get; set; }

    public string? TagsJson { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
