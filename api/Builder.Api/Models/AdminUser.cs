namespace Builder.Api.Models;

public sealed class AdminUser
{
    public Guid Id { get; set; }

    public string Username { get; set; } = "";

    public string PasswordHash { get; set; } = "";

    public string PasswordSalt { get; set; } = "";

    public string Role { get; set; } = "author";

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<AdminSession> Sessions { get; set; } = new List<AdminSession>();
}
