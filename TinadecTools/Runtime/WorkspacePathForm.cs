namespace TinadecTools.Runtime;

/// <summary>
/// The spelling a directory is actually addressed by: every symlink in the existing prefix resolved,
/// with missing trailing segments appended unchanged so a file that does not exist yet still lands
/// under the directories that do.
///
/// <para>
/// This is a deliberate copy of <c>TinadecCore.Abstractions.Ports.WorkspacePathSpelling</c>. The
/// tools process must not reference Core — it is the sandboxed child, and the dependency direction
/// is the boundary — so the two halves of one comparison live in two assemblies. Change one and
/// change the other; the tests in <c>WorkspacePathFormTests</c> pin the behaviour both sides rely on.
/// </para>
/// </summary>
internal static class WorkspacePathForm
{
    public static string Canonical(
        string path,
        Func<string, bool>? directoryExists = null,
        Func<string, string?>? resolveOneLink = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        directoryExists ??= Directory.Exists;
        resolveOneLink ??= ResolveOneLink;

        var full = Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));

        var missing = new List<string>();
        var existing = full;
        while (!directoryExists(existing))
        {
            var parent = Path.GetDirectoryName(existing);
            if (string.IsNullOrEmpty(parent) || parent == existing) return full;
            missing.Add(Path.GetFileName(existing));
            existing = parent;
        }

        var resolved = ResolvePrefix(existing, resolveOneLink) ?? existing;
        for (var i = missing.Count - 1; i >= 0; i--)
            resolved = Path.Combine(resolved, missing[i]);

        return Path.TrimEndingDirectorySeparator(resolved);
    }

    /// <summary>
    /// Component by component from the root down. .NET's own resolver answers <c>null</c> when the
    /// last component is not a link, which is the ordinary case — on macOS only the first two
    /// components of <c>/var/folders/…</c> are links.
    /// </summary>
    private static string? ResolvePrefix(string directory, Func<string, string?> resolveOneLink)
    {
        var root = Path.GetPathRoot(directory);
        if (string.IsNullOrEmpty(root)) return null;

        var result = Path.TrimEndingDirectorySeparator(root);
        foreach (var segment in directory[root.Length..].Split(
                     Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar, StringSplitOptions.RemoveEmptyEntries))
        {
            var candidate = Path.Combine(result, segment);
            result = resolveOneLink(candidate) ?? candidate;
        }

        return result == directory ? null : result;
    }

    private static string? ResolveOneLink(string path)
    {
        try
        {
            return Directory.Exists(path)
                ? new DirectoryInfo(path).ResolveLinkTarget(false)?.FullName
                : new FileInfo(path).ResolveLinkTarget(false)?.FullName;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException)
        {
            return null;
        }
    }
}
