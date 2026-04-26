namespace Builder.Runtime.Mvc.Models;

public sealed class BuilderApiOptions
{
    public const string SectionName = "BuilderApi";

    public string BaseUrl { get; set; } = "http://127.0.0.1:5056";

    public string DefaultPageSlug { get; set; } = "home";
}

