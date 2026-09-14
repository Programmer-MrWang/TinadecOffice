using System.Text.Json;
using TinadecCore.Abstractions.Ports;

namespace TinadecCore.Tools;

/// <summary>
/// WS-8 per-tool resource-path extraction for the resource envelope.
///
/// The envelope authorizes a workspace-relative path PREFIX per tool call, so
/// Core has to know which argument names the target path. The table is
/// deliberately tiny and explicit: an unregistered tool yields "no single path"
/// and falls back to the level-only decision, which never widens anything — the
/// tool process still refuses every path outside its own workspace root.
///
/// Parameter names come from the real TinadecTools definitions, never guessed:
/// <c>read_file</c> and <c>write_file</c> both bind their target to the JSON
/// property <c>filepath</c> (<c>NormalFileReadParams.FilePath</c> /
/// <c>WriteFileParams.FilePath</c>). <c>shell</c>, <c>mcp_search</c>,
/// <c>mcp_invoke</c> and <c>git_*</c> have no single target path (repository- or
/// process-scoped), so they stay unregistered on purpose.
/// </summary>
internal static class ToolResourcePathRegistry
{
    /// <summary>Tool id -> the JSON parameter carrying the target path.</summary>
    private static readonly IReadOnlyDictionary<string, string> PathParameterByTool =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["read_file"] = "filepath",
            ["write_file"] = "filepath",
        };

    /// <summary>Whether the tool declares a single target path enforced this phase.</summary>
    public static bool IsRegistered(string? toolId) =>
        !string.IsNullOrWhiteSpace(toolId) && PathParameterByTool.ContainsKey(toolId);

    /// <summary>
    /// Extract the workspace-relative target path of a tool call.
    ///
    /// Returns null — meaning "level-only decision" — when the tool has no single
    /// path, the parameters are unusable, or the target escapes the workspace.
    /// The escaping case is still fail-closed overall: the tool process resolves
    /// the same path against its workspace root and refuses anything outside it,
    /// so falling back to the level decision cannot grant a path the prefix would
    /// have refused.
    /// </summary>
    public static string? TryExtractRelativePath(string? toolId, string? parametersJson, string? workspaceRoot)
    {
        if (!IsRegistered(toolId) || string.IsNullOrWhiteSpace(parametersJson)) return null;
        string? raw;
        try
        {
            using var document = JsonDocument.Parse(parametersJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object) return null;
            if (!document.RootElement.TryGetProperty(PathParameterByTool[toolId!], out var element)) return null;
            if (element.ValueKind != JsonValueKind.String) return null;
            raw = element.GetString();
        }
        catch (JsonException)
        {
            return null;
        }

        return NormalizeRelativePath(ToRelativePath(raw, workspaceRoot));
    }

    /// <summary>
    /// Build the resource claim for one tool call, or null when the call has no
    /// single target path. The claim action mirrors the tool's mutation class so
    /// the PDP resource boundary can apply the read/write level to the target.
    /// </summary>
    public static CapabilityClaim? TryBuildResourceClaim(
        string? toolId,
        string? parametersJson,
        string? workspaceRoot,
        bool mutating)
    {
        var relativePath = TryExtractRelativePath(toolId, parametersJson, workspaceRoot);
        if (relativePath is null) return null;
        return new CapabilityClaim("resource.access", mutating ? "mutate" : "read", $"path://{relativePath}");
    }

    /// <summary>
    /// Read the workspace-relative target a resource claim carries
    /// (<c>resource.access</c> / <c>path://&lt;workspace-relative&gt;</c>).
    /// Returns null for an absent claim or any other resource shape — "no path
    /// dimension", so the level decision stands alone.
    /// </summary>
    public static string? TryReadResourceClaimPath(CapabilityClaim? resourceClaim)
    {
        if (resourceClaim is null) return null;
        var resource = resourceClaim.Resource;
        if (string.IsNullOrWhiteSpace(resource)) return null;
        if (!resource.StartsWith("path://", StringComparison.OrdinalIgnoreCase)) return null;
        return NormalizeRelativePath(resource[7..]);
    }

    /// <summary>
    /// Normalize a target into a forward-slash workspace-relative path. Returns
    /// null when the target cannot be expressed relative to the workspace —
    /// including any ".." that would walk out of it.
    /// </summary>
    public static string? NormalizeRelativePath(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var segments = new List<string>();
        foreach (var segment in raw.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries))
        {
            if (segment == ".") continue;
            if (segment == "..") return null;
            segments.Add(segment);
        }

        return segments.Count == 0 ? null : string.Join('/', segments);
    }

    private static string? ToRelativePath(string? raw, string? workspaceRoot)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim();
        if (!Path.IsPathRooted(trimmed)) return trimmed;
        if (string.IsNullOrWhiteSpace(workspaceRoot)) return null;
        try
        {
            return Path.GetRelativePath(Path.GetFullPath(workspaceRoot), trimmed);
        }
        catch (Exception ex) when (ex is ArgumentException or PathTooLongException or NotSupportedException)
        {
            return null;
        }
    }
}
