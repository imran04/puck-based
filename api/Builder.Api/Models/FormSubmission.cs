namespace Builder.Api.Models;

public sealed class FormSubmission
{
    public Guid Id { get; set; }

    public string FormTitle { get; set; } = "Form";

    public string PayloadJson { get; set; } = "{}";

    public DateTimeOffset CreatedAt { get; set; }
}
