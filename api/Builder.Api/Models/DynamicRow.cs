namespace Builder.Api.Models;

public sealed class DynamicRow
{
    public Guid Id { get; set; }

    public Guid TableId { get; set; }

    /// <summary>JSON object of field values keyed by column name</summary>
    public string DataJson { get; set; } = "{}";

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public TableDefinition? Table { get; set; }
}
