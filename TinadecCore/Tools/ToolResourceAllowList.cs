namespace TinadecCore.Tools;

/// <summary>
/// Named decision step for resource-grant evaluation (WS-4 envelope + WS-8 path
/// prefix enforcement).
///
/// Grants are frozen per instance as level-prefixed, forward-slash,
/// workspace-relative prefixes (<c>read:&lt;prefix&gt;</c> /
/// <c>write:&lt;prefix&gt;</c>; an empty prefix means the whole workspace). Write
/// implies read. An empty grant list is the fail-closed "no workspace
/// authorization" state — never "unrestricted" — and the historical coarse
/// tokens (<c>workspace</c>/<c>project</c>) are not grants at all any more.
///
/// Enforcement split:
/// • here (cheap pre-check at scope resolution + PDP resource_access boundary):
///   the grant LIST, its path PREFIXES and the read/write LEVEL decide the
///   workspace target.
/// • the tool process independently refuses any path outside its workspace root.
/// A tool without a single target path (shell, mcp_*, git_*) is decided by level
/// only; that fallback never widens a path-scoped grant, because such a tool has
/// no path to narrow in the first place.
/// </summary>
internal static class ToolResourceAllowList
{
    /// <summary>
    /// Boolean projection for the cheap pre-check at scope resolution: a
    /// non-empty grant list authorizes the workspace root. Levels and prefixes
    /// are enforced per claim by the PDP resource_access boundary.
    /// </summary>
    public static bool IsAllowed(IReadOnlyList<string> grants) =>
        Evaluate(grants, relativePath: null, mutating: false).Allowed;

    /// <summary>
    /// Decide one workspace target. <paramref name="relativePath"/> is the
    /// workspace-relative target normalized by <see cref="ToolResourcePathRegistry"/>;
    /// null means the tool has no single path and only the level is checked.
    /// </summary>
    public static ResourceAllowDecision Evaluate(IReadOnlyList<string> grants, string? relativePath, bool mutating)
    {
        if (grants.Count == 0) return new ResourceAllowDecision(false, ResourceAllowBasis.NoGrant, null);

        if (string.IsNullOrEmpty(relativePath))
        {
            foreach (var grant in grants)
            {
                if (!TryParseGrant(grant, out var write, out _)) continue;
                if (mutating && !write) continue;
                return new ResourceAllowDecision(true, ResourceAllowBasis.Granted, grant);
            }

            return new ResourceAllowDecision(false, ResourceAllowBasis.LevelDenied, null);
        }

        // A grant string carries a normalized prefix already; the target is
        // normalized the same way so the comparison is purely ordinal.
        var normalizedTarget = ToolResourcePathRegistry.NormalizeRelativePath(relativePath);
        if (normalizedTarget is null) return new ResourceAllowDecision(false, ResourceAllowBasis.PathDenied, null);

        var sawLevelMatch = false;
        foreach (var grant in grants)
        {
            if (!TryParseGrant(grant, out var write, out var prefix)) continue;
            if (mutating && !write) continue;
            sawLevelMatch = true;
            if (CoversPrefix(prefix, normalizedTarget))
                return new ResourceAllowDecision(true, ResourceAllowBasis.Granted, grant);
        }

        // Distinguish "the level was never granted" from "the level was granted
        // but no prefix covers this target": both deny, but the basis is the
        // operator-visible reason.
        return new ResourceAllowDecision(false, sawLevelMatch ? ResourceAllowBasis.PathDenied : ResourceAllowBasis.LevelDenied, null);
    }

    /// <summary>Parse "read:/write:" level prefix. Unknown forms are not grants.</summary>
    private static bool TryParseGrant(string grant, out bool write, out string prefix)
    {
        write = false;
        prefix = string.Empty;
        if (string.IsNullOrWhiteSpace(grant)) return false;
        var trimmed = grant.Trim();
        if (trimmed.StartsWith("read:", StringComparison.OrdinalIgnoreCase))
        {
            prefix = trimmed[5..];
        }
        else if (trimmed.StartsWith("write:", StringComparison.OrdinalIgnoreCase))
        {
            write = true;
            prefix = trimmed[6..];
        }
        else
        {
            return false;
        }

        prefix = prefix.Replace('\\', '/').Trim('/');
        return true;
    }

    /// <summary>An empty prefix covers the whole workspace; otherwise match on a path-segment boundary.</summary>
    private static bool CoversPrefix(string prefix, string path)
    {
        if (prefix.Length == 0) return true;
        if (string.Equals(prefix, path, StringComparison.OrdinalIgnoreCase)) return true;
        return path.Length > prefix.Length
            && path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            && path[prefix.Length] == '/';
    }
}

internal enum ResourceAllowBasis
{
    Granted,
    NoGrant,
    LevelDenied,
    PathDenied
}

internal sealed record ResourceAllowDecision(bool Allowed, ResourceAllowBasis Basis, string? MatchedGrant);
