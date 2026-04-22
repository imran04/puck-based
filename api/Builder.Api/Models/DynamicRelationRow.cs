namespace Builder.Api.Models;

/// <summary>Junction row for many-to-many relations between DynamicRows</summary>
public sealed class DynamicRelationRow
{
    public Guid Id { get; set; }

    public Guid RelationId { get; set; }

    public Guid FromRowId { get; set; }

    public Guid ToRowId { get; set; }

    public TableRelation? Relation { get; set; }
}
