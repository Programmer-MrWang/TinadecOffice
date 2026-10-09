using System.Text.Json;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Contracts.Dtos;

namespace TinadecCore.Tools;

/// <summary>
/// WS-8 per-tool resource-path extraction for the resource envelope.
///
/// The envelope authorizes a workspace-relative path PREFIX per tool call, so
/// Core has to know which argument names the target path. The table covers every
/// provider tool that has a single workspace target; a tool with no single path
/// (e.g. <c>mcp_search</c>, <c>mcp_invoke</c>) yields "no single path" and falls
/// back to the level-only decision, which never widens anything — the tool process
/// still refuses every path outside its own workspace root.
///
/// Parameter names come from the real TinadecTools definitions, never guessed:
/// <c>read_file</c>/<c>write_file</c> bind <c>filepath</c>, <c>ls</c>/<c>stat</c>/
/// <c>file_search</c> bind <c>path</c>, <c>shell</c> binds <c>cwd</c>,
/// <c>command_run</c> binds <c>working_directory</c>, and every <c>git_*</c> tool
/// binds <c>repository_path</c>.
/// </summary>
internal static class ToolResourcePathRegistry
{
    private const string GitPathParameter = "repository_path";

    /// <summary>Tool id -> the JSON parameter carrying the target path.</summary>
    private static readonly IReadOnlyDictionary<string, string> PathParameterByTool =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["read_file"] = "filepath",
            ["write_file"] = "filepath",
            ["delete_file"] = "filepath",
            // The line/byte mutation family binds the same "filepath" property
            // (FileWriter.cs): without them the WS-8 prefix narrowing silently
            // degraded to a level-only decision for every edit after the first write.
            ["replace_lines"] = "filepath",
            ["replace_bytes"] = "filepath",
            ["insert_line"] = "filepath",
            ["insert_bytes"] = "filepath",
            ["insert_byte"] = "filepath",
            ["delete_line"] = "filepath",
            ["delete_bytes"] = "filepath",
            ["ls"] = "path",
            ["stat"] = "path",
            ["file_search"] = "path",
            ["shell"] = "cwd",
            ["command_run"] = "working_directory",
        };

    /// <summary>The path parameter of a tool, or null when the tool has no single workspace target.</summary>
    private static string? PathParameter(string? toolId)
    {
        if (string.IsNullOrWhiteSpace(toolId)) return null;
        if (PathParameterByTool.TryGetValue(toolId, out var parameter)) return parameter;
        // Every git tool targets the repository it was handed.
        return toolId.StartsWith("git_", StringComparison.OrdinalIgnoreCase) ? GitPathParameter : null;
    }

    /// <summary>Whether the tool declares a single target path enforced this phase.</summary>
    public static bool IsRegistered(string? toolId) => PathParameter(toolId) is not null;

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
        var parameter = PathParameter(toolId);
        if (parameter is null || string.IsNullOrWhiteSpace(parametersJson)) return null;
        string? raw;
        try
        {
            using var document = JsonDocument.Parse(parametersJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object) return null;
            if (!document.RootElement.TryGetProperty(parameter, out var element)) return null;
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
        bool mutating,
        ToolExecutionContextDto? executionContext = null)
    {
        var relativePath = TryExtractRelativePath(toolId, parametersJson, workspaceRoot);
        // A primary file such as "second/same.txt" and a secondary source's
        // "same.txt" must never yield the same resource identity. Preserve the
        // single-root envelope spelling, but qualify every source in a multi-root run.
        if (executionContext?.WorkspaceRoots.Count > 1 && PathParameter(toolId) is { } sourceParameter
            && !string.IsNullOrWhiteSpace(parametersJson))
        {
            try
            {
                using var sourceDocument = JsonDocument.Parse(parametersJson);
                if (sourceDocument.RootElement.TryGetProperty(sourceParameter, out var sourceValue)
                    && sourceValue.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(sourceValue.GetString()))
                {
                    var absolute = Path.GetFullPath(sourceValue.GetString()!, workspaceRoot ?? executionContext.WorkingDirectory
                        ?? executionContext.WorkspaceRoots[0].Path);
                    foreach (var source in executionContext.WorkspaceRoots.OrderByDescending(root => root.Path.Length))
                    {
                        if (!WorkspaceSkillDiscovery.IsContained(source.Path, absolute)) continue;
                        var relative = Path.GetRelativePath(source.Path, absolute).Replace('\\', '/');
                        return new("resource.access", mutating ? "mutate" : "read", $"path://{source.Id}/{relative}");
                    }
                }
            }
            catch (Exception ex) when (ex is JsonException or ArgumentException or IOException or NotSupportedException or UnauthorizedAccessException)
            { return new("resource.access", mutating ? "mutate" : "read", "denied-path://invalid-target"); }
        }
        if (relativePath is null)
        {
            var parameter = PathParameter(toolId);
            if (executionContext is null || parameter is null || string.IsNullOrWhiteSpace(parametersJson)) return null;
            try
            {
                using var document = JsonDocument.Parse(parametersJson);
                if (!document.RootElement.TryGetProperty(parameter, out var value) || value.ValueKind != JsonValueKind.String) return null;
                var path = value.GetString();
                if (string.IsNullOrWhiteSpace(path)) return null;
                if (Path.IsPathRooted(path))
                    foreach (var source in executionContext.WorkspaceRoots)
                    {
                        if (!WorkspaceSkillDiscovery.IsContained(source.Path, path)) continue;
                        var relative = Path.GetRelativePath(source.Path, Path.GetFullPath(path)).Replace('\\', '/');
                        return new("resource.access", mutating ? "mutate" : "read", $"path://{source.Id}/{relative}");
                    }
                if (!mutating && toolId is "read_file" or "ls" or "stat" && Path.IsPathRooted(path))
                    foreach (var root in executionContext.ReadRoots)
                    {
                        if (!WorkspaceSkillDiscovery.IsContained(root.Path, path)) continue;
                        var relative = Path.GetRelativePath(root.Path, Path.GetFullPath(path)).Replace('\\', '/');
                        return new("resource.access", "read", $"skill://{root.ResourceId:D}/{Uri.EscapeDataString(relative)}");
                    }
                // A managed context must not turn an unrepresentable path into a level-only grant.
                return new("resource.access", mutating ? "mutate" : "read", "denied-path://outside-frozen-roots");
            }
            catch (Exception ex) when (ex is JsonException or ArgumentException or IOException or NotSupportedException or UnauthorizedAccessException)
            { return new("resource.access", mutating ? "mutate" : "read", "denied-path://invalid-target"); }
        }
        return new CapabilityClaim("resource.access", mutating ? "mutate" : "read",
            relativePath == "." ? "workspace-root://root" : $"path://{relativePath}");
    }

    public static bool IsAuthorizedSkillClaim(CapabilityClaim resourceClaim, IReadOnlyList<ToolReadRootDto> roots)
    {
        if (resourceClaim.Action != "read" || !resourceClaim.Resource.StartsWith("skill://", StringComparison.Ordinal)) return false;
        var resource = resourceClaim.Resource[8..];
        var separator = resource.IndexOf('/');
        if (separator < 0 || !Guid.TryParse(resource[..separator], out var id)) return false;
        var root = roots.FirstOrDefault(x => x.ResourceId == id);
        if (root is null) return false;
        try
        {
            var relative = Uri.UnescapeDataString(resource[(separator + 1)..]);
            if (Path.IsPathRooted(relative) || relative.Split('/', '\\').Any(x => x == "..")) return false;
            return WorkspaceSkillDiscovery.IsContained(root.Path, Path.Combine(root.Path, relative));
        }
        catch (Exception ex) when (ex is ArgumentException or IOException or NotSupportedException or UnauthorizedAccessException) { return false; }
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
        if (resource.Equals("workspace-root://root", StringComparison.Ordinal)) return ".";
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

        // A dot-only target is the workspace itself. Keep it distinct from an absent/escaped
        // path so managed contexts permit root operations while narrowed prefixes still apply.
        return segments.Count == 0 ? "." : string.Join('/', segments);
    }

    private static string? ToRelativePath(string? raw, string? workspaceRoot)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim();
        if (!Path.IsPathRooted(trimmed)) return trimmed;
        if (string.IsNullOrWhiteSpace(workspaceRoot)) return null;
        try
        {
            var relative = Path.GetRelativePath(Path.GetFullPath(workspaceRoot), trimmed);
            // Across volumes GetRelativePath returns a rooted path instead of a ".." walk, and a
            // rooted answer is not a workspace-relative claim: the grant would name a path the tool
            // process itself refuses to touch, so the two layers would disagree about who is covered.
            return Path.IsPathRooted(relative) ? null : relative;
        }
        catch (Exception ex) when (ex is ArgumentException or PathTooLongException or NotSupportedException)
        {
            return null;
        }
    }
}
