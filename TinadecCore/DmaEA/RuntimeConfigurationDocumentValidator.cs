using TinadecCore.Abstractions.Ports;

namespace TinadecCore.DmaEA;

internal sealed class RuntimeConfigurationDocumentValidator : IConfigurationDocumentValidator
{
    public string DocumentId => "runtime";
    public IReadOnlyList<ConfigurationDiagnostic> Validate(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [new("runtime_configuration_missing", "The runtime configuration document is required.")];
        try { _ = AgentRuntimeConfigurationStore.LoadSnapshotText(text, "runtime.toml", 1); return []; }
        catch (Exception ex) when (ex is InvalidDataException or FormatException or OverflowException or ArgumentException)
        { return [new("runtime_configuration_invalid", ex.Message)]; }
    }
}
