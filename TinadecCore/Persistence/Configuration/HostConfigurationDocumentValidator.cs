using TinadecCore.Abstractions.Ports;
using Tomlyn;
using Tomlyn.Model;

namespace TinadecCore.Persistence;

internal sealed class HostConfigurationDocumentValidator(string documentId) : IConfigurationDocumentValidator
{
    public string DocumentId => documentId;

    public IReadOnlyList<ConfigurationDiagnostic> Validate(string text)
    {
        var model = TomlSerializer.Deserialize<TomlTable>(text)!;
        if (!model.TryGetValue(documentId, out var value) || value is not TomlTable settings)
            return [new("configuration_section_missing", documentId + ".toml requires [" + documentId + "].")];
        if (documentId == "storage")
        {
            var allowed = new HashSet<string>(["backend", "postgres_connection_reference"], StringComparer.Ordinal);
            var errors = settings.Keys.Where(key => !allowed.Contains(key))
                .Select(key => new ConfigurationDiagnostic("storage_setting_unknown", "Unknown storage setting: " + key + ". Connection credentials must be bound through the user security store.")).ToList();
            if (!settings.TryGetValue("backend", out var backend) || backend is not string name || name is not ("sqlite" or "postgresql"))
                errors.Add(new("storage_backend_invalid", "storage.backend must be sqlite or postgresql."));
            if (settings.TryGetValue("postgres_connection_reference", out var reference)
                && (reference is not string id || string.IsNullOrWhiteSpace(id) || id.Contains('=') || id.Contains(';')
                    || id.Contains("postgres://", StringComparison.OrdinalIgnoreCase) || id.Contains("postgresql://", StringComparison.OrdinalIgnoreCase)))
                errors.Add(new("storage_secret_reference_invalid", "postgres_connection_reference must name a user security store binding; inline connection credentials are forbidden."));
            if (backend is "postgresql" && !settings.ContainsKey("postgres_connection_reference"))
                errors.Add(new("storage_secret_reference_required", "PostgreSQL requires postgres_connection_reference."));
            return errors;
        }
        if (!settings.TryGetValue("rotation_bytes", out var rotation) || rotation is not long rotationBytes
            || !settings.TryGetValue("total_bytes", out var total) || total is not long totalBytes
            || rotationBytes < 4096 || totalBytes < rotationBytes)
            return [new("logging_capacity_invalid", "logging.toml requires integer total_bytes >= rotation_bytes >= 4096.")];
        return [];
    }
}
