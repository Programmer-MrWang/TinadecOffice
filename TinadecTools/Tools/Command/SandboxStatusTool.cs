using System.Text.Json.Serialization;
using TinadecTools.Abstractions;
using TinadecTools.Runtime.Sandbox;

namespace TinadecTools.Tools.Command;

public sealed class SandboxStatusParams { }

public sealed class SandboxStatusResponse
{
    [JsonPropertyName("supported")]
    public bool Supported { get; set; }

    [JsonPropertyName("initialized")]
    public bool Initialized { get; set; }

    [JsonPropertyName("policy_configured")]
    public bool PolicyConfigured { get; set; }
    [JsonPropertyName("reason")] public string? Reason { get; set; }
}

[JsonSourceGenerationOptions(WriteIndented = false)]
[JsonSerializable(typeof(SandboxStatusParams))]
[JsonSerializable(typeof(SandboxStatusResponse))]
internal partial class SandboxStatusToolJsonContext : JsonSerializerContext { }

public static class SandboxStatusTool
{
    [ToolFunction("sandbox_status", Description = "Report whether the command sandbox is supported on this machine, initialized, and has a policy configured.")]
    public static async ValueTask<SandboxStatusResponse> HandleAsync(
        SandboxStatusParams args,
        CancellationToken cancellationToken)
    {
        var backend = CommandSandboxRuntime.GetBackend();
        string? reason = null;
        if (OperatingSystem.IsLinux() || OperatingSystem.IsMacOS())
            try { await backend.EnsureSetupAsync(cancellationToken); }
            catch (Exception ex) when (ex is not OperationCanceledException) { reason = ex.Message; }
        var policy = SandboxPolicyStore.Load();
        return new SandboxStatusResponse
        {
            Supported = backend.IsSupported,
            Initialized = backend.IsInitialized,
            Reason = reason,
            PolicyConfigured = policy.ReadPaths.Count > 0
                || policy.WritePaths.Count > 0
                || policy.EnvironmentVariables.Count > 0
        };
    }
}
