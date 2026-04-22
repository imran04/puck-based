namespace Builder.Api.Models;

public sealed class TableDefinition
{
    public Guid Id { get; set; }

    public string Name { get; set; } = "";

    public string DisplayName { get; set; } = "";

    /// <summary>JSON array of ColumnDefinition objects</summary>
    public string ColumnsJson { get; set; } = "[]";

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public List<TableRelation> RelationsFrom { get; set; } = [];

    public List<TableRelation> RelationsTo { get; set; } = [];

    public List<DynamicRow> Rows { get; set; } = [];
}
