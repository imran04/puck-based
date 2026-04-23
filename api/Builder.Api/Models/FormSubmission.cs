namespace Builder.Api.Models;

public sealed class FormSubmission
{
    public Guid Id { get; set; }

    public string? PageId { get; set; }

    public string? PageSlug { get; set; }

    public string? FormId { get; set; }

    public string FormTitle { get; set; } = "Form";

    public string PayloadJson { get; set; } = "{}";

    public Guid? DynamicRowId { get; set; }

    public string? RelayStatus { get; set; }

    public int? RelayStatusCode { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
