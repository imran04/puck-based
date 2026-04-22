namespace Builder.Api.Models;

/// <summary>Relation between two TableDefinitions. RelationType is one_to_one | one_to_many | many_to_many</summary>
public sealed class TableRelation
{
    public Guid Id { get; set; }

    public Guid FromTableId { get; set; }

    public Guid ToTableId { get; set; }

    public string RelationType { get; set; } = "one_to_many";

    public string DisplayName { get; set; } = "";

    public DateTimeOffset CreatedAt { get; set; }

    public TableDefinition? FromTable { get; set; }

    public TableDefinition? ToTable { get; set; }

    public List<DynamicRelationRow> JunctionRows { get; set; } = [];
}
