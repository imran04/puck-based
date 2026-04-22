namespace Builder.Api.Models;

public sealed class CustomBlock
{
    public Guid Id { get; set; }

    public string Name { get; set; } = "";

    public string Kind { get; set; } = "section";

    public string ComponentType { get; set; } = "";

    public string DataJson { get; set; } = "{}";

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
