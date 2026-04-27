using System.Security.Cryptography;
using System.Text;

namespace Builder.Api.Services;

public sealed class AdminAuthService(IConfiguration configuration, IHostEnvironment environment)
{
    private readonly IConfiguration _configuration = configuration;
    private readonly IHostEnvironment _environment = environment;

    public int SessionTtlSeconds
    {
        get
        {
            var configured = _configuration.GetValue<int?>("BuilderAuth:SessionTtlSeconds")
                ?? _configuration.GetValue<int?>("BUILDER_SESSION_TTL_SECONDS")
                ?? 60 * 60 * 12;

            return Math.Clamp(configured, 60, 60 * 60 * 24 * 14);
        }
    }

    public string? LegacyBuilderToken =>
        (_configuration["BuilderAuth:LegacyToken"] ?? _configuration["BUILDER_TOKEN"])?.Trim();

    public IReadOnlyList<(string Username, string Password, string Role)> ResolveConfiguredUsers()
    {
        var combinedRaw = (_configuration["BuilderAuth:Users"] ?? _configuration["BUILDER_USERS"])?.Trim();
        var combined = ParseCombinedUsers(combinedRaw);
        if (combined.Count > 0)
            return combined;

        var dedicated = ParseDedicatedUsers();
        if (dedicated.Count > 0)
            return dedicated;

        if (_environment.IsDevelopment())
        {
            return
            [
                ("author", "author123", "author"),
                ("editor", "editor123", "editor"),
            ];
        }

        return [];
    }

    public static string NormalizeRole(string? rawRole)
    {
        return string.Equals(rawRole?.Trim(), "editor", StringComparison.OrdinalIgnoreCase)
            ? "editor"
            : "author";
    }

    public static (string Hash, string Salt) HashPassword(string password)
    {
        var saltBytes = RandomNumberGenerator.GetBytes(16);
        var hashBytes = Rfc2898DeriveBytes.Pbkdf2(
            password,
            saltBytes,
            120_000,
            HashAlgorithmName.SHA256,
            32);

        return (Convert.ToBase64String(hashBytes), Convert.ToBase64String(saltBytes));
    }

    public static bool VerifyPassword(string password, string hashBase64, string saltBase64)
    {
        try
        {
            var saltBytes = Convert.FromBase64String(saltBase64);
            var expectedHash = Convert.FromBase64String(hashBase64);
            var actualHash = Rfc2898DeriveBytes.Pbkdf2(
                password,
                saltBytes,
                120_000,
                HashAlgorithmName.SHA256,
                expectedHash.Length);

            return CryptographicOperations.FixedTimeEquals(expectedHash, actualHash);
        }
        catch
        {
            return false;
        }
    }

    public static string CreateSessionToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    public static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }

    private static List<(string Username, string Password, string Role)> ParseCombinedUsers(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return [];

        var list = new List<(string Username, string Password, string Role)>();
        var entries = raw.Replace("\r", "").Replace("\n", ",").Split(',', StringSplitOptions.RemoveEmptyEntries);
        foreach (var entry in entries)
        {
            var parts = entry.Split(':', 3, StringSplitOptions.TrimEntries);
            if (parts.Length < 2)
                continue;

            var username = parts[0].Trim();
            var password = parts[1];
            var role = parts.Length == 3 ? parts[2] : "author";

            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
                continue;

            list.Add((username, password, NormalizeRole(role)));
        }

        return list;
    }

    private List<(string Username, string Password, string Role)> ParseDedicatedUsers()
    {
        var users = new List<(string Username, string Password, string Role)>();

        var authorUsername = (_configuration["BuilderAuth:AuthorUsername"] ?? _configuration["BUILDER_AUTHOR_USERNAME"])?.Trim();
        var authorPassword = _configuration["BuilderAuth:AuthorPassword"] ?? _configuration["BUILDER_AUTHOR_PASSWORD"];
        if (!string.IsNullOrWhiteSpace(authorUsername) && !string.IsNullOrWhiteSpace(authorPassword))
            users.Add((authorUsername, authorPassword, "author"));

        var editorUsername = (_configuration["BuilderAuth:EditorUsername"] ?? _configuration["BUILDER_EDITOR_USERNAME"])?.Trim();
        var editorPassword = _configuration["BuilderAuth:EditorPassword"] ?? _configuration["BUILDER_EDITOR_PASSWORD"];
        if (!string.IsNullOrWhiteSpace(editorUsername) && !string.IsNullOrWhiteSpace(editorPassword))
            users.Add((editorUsername, editorPassword, "editor"));

        return users;
    }
}
