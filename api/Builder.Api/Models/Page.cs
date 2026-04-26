namespace Builder.Api.Models;

public sealed class Page
{
    public string Id { get; set; } = "";

    public string Title { get; set; } = "Puck Studio Page";

    public string Slug { get; set; } = "";

    public string DraftJson { get; set; } = "{}";

    public string? PublishedJson { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset? PublishedAt { get; set; }

    /// <summary>
    /// Lifecycle status: draft, published, archived, deleted.
    /// </summary>
    public PageLifecycleStatus Status { get; set; } = PageLifecycleStatus.Draft;

    /// <summary>
    /// True when the currently published runtime assembly is compiled and available.
    /// </summary>
    public bool IsCompiled { get; set; }

    /// <summary>
    /// JSON object containing displaySources (with legacy dataSources alias).
    /// </summary>
    public string? DataSourceMapJson { get; set; }

    /// <summary>Human-readable Razor CSHTML template with @ViewBag syntax (stored as artifact)</summary>
    public string? RazorTemplate { get; set; }

    /// <summary>Compiled .NET assembly bytes from the PageRenderer class</summary>
    public byte[]? CompiledAssemblyBytes { get; set; }
}
