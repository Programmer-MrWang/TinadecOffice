namespace TinadecCore.Abstractions.Ports;

/// <summary>Editable configuration in one storage scope. The file bytes are authoritative.</summary>
public interface IScopeConfigurationDocuments
{
    IReadOnlyList<string> DocumentIds { get; }
    Task<ScopeConfigurationDocument> ReadAsync(string id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ConfigurationDiagnostic>> ValidateAsync(string id, string text, CancellationToken cancellationToken = default);
    Task<ScopeConfigurationDocument> SaveIfMatchAsync(string id, string text, string expectedContentHash, CancellationToken cancellationToken = default);
}

public sealed record ScopeConfigurationDocument(
    string Id, string Path, string Text, string ContentHash,
    IReadOnlyList<ConfigurationDiagnostic> Diagnostics, long Version);

public sealed record ConfigurationDiagnostic(string Code, string Message, string Severity = "error", int? Line = null, int? Column = null);

/// <summary>Rebuilds editable database projections, and verifies the exact files admitted to a new run.</summary>
public interface IConfigurationProjectionCoordinator
{
    Task ReconcileAsync(CancellationToken cancellationToken = default);
    Task<EffectiveConfigurationSnapshot> CompileAsync(CancellationToken cancellationToken = default);
    Task VerifyAsync(EffectiveConfigurationSnapshot snapshot, CancellationToken cancellationToken = default);
}

public sealed record EffectiveConfigurationSnapshot(string StorageId, string ContentHash, IReadOnlyDictionary<string, string> Documents);

public sealed class ConfigurationDocumentException(
    string code, string message, IReadOnlyList<ConfigurationDiagnostic>? diagnostics = null) : InvalidOperationException(message)
{
    public string Code { get; } = code;
    public IReadOnlyList<ConfigurationDiagnostic> Diagnostics { get; } = diagnostics ?? [];
}

/// <summary>Module-owned semantic validation supplements TOML syntax validation.</summary>
public interface IConfigurationDocumentValidator
{
    string DocumentId { get; }
    IReadOnlyList<ConfigurationDiagnostic> Validate(string text);
}
