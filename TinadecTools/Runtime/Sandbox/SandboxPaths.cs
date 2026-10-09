using System.Security.Principal;
using System.Security.Cryptography;
using System.Text;
using TinadecTools.Tools.FileRW;

namespace TinadecTools.Runtime.Sandbox;

internal static class SandboxPaths
{
    internal const uint TnadIdentifierAuthority = 0x54494E41; // "TINA"

    /// <summary>
    /// The one comparer for sandbox paths and environment-variable names. Both axes of the
    /// sandbox (containment checks and grant deduplication) must agree with the file system's
    /// own case rules: on Linux <c>/ws</c> and <c>/WS</c> are two different directories, so a
    /// case-insensitive union there would silently collapse two grants into one.
    /// </summary>
    internal static readonly StringComparer PathComparer = OperatingSystem.IsWindows()
        ? StringComparer.OrdinalIgnoreCase
        : StringComparer.Ordinal;

    private static readonly StringComparison Cmp = PathComparer == StringComparer.OrdinalIgnoreCase
        ? StringComparison.OrdinalIgnoreCase
        : StringComparison.Ordinal;

    // ── workspace confinement ─────────────────────────────────────────────────

    internal static string ValidateWorkingDirectory(string workingDirectory)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(workingDirectory);
        var full = WorkspacePathResolver.ResolveDirectory(workingDirectory);
        full = Path.TrimEndingDirectorySeparator(full);
        if (!IsWithinWorkspace(full))
            throw new UnauthorizedAccessException("working_directory must be inside the workspace root.");
        return full;
    }

    internal static bool IsWithinWorkspace(string full)
    {
        var root = WorkspacePathResolver.WorkspaceRoot;
        if (string.Equals(full, root, Cmp)) return true;
        var prefix = root + Path.DirectorySeparatorChar;
        return full.StartsWith(prefix, Cmp);
    }

    // ── external grant normalization ──────────────────────────────────────────

    /// <summary>
    /// Normalizes an extra sandbox grant (command_run's additional_read_paths /
    /// additional_write_paths). The sandbox is a separate, approval-gated capability
    /// with its own confinement (<see cref="ValidateWorkingDirectory"/> /
    /// <see cref="EnsureNotBroadWriteTarget"/>), so a grant is NOT restricted to the
    /// workspace roots: that is a deliberate product decision, not an oversight.
    /// Registered follow-up: reconcile these grants with the frozen workspace roots
    /// so a run cannot persist write access outside its workspace.
    /// </summary>
    internal static string NormalizeGrantPath(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        var full = Path.GetFullPath(path, WorkspacePathResolver.WorkspaceRoot);
        full = Path.TrimEndingDirectorySeparator(full);
        if (!Directory.Exists(full))
            throw new DirectoryNotFoundException($"Directory does not exist: {full}");
        return full;
    }

    /// <summary>
    /// A command grant must not turn a frozen Skill read root into a writable tree. Check both
    /// directions: writing below the root is obvious, while granting the root's parent is the
    /// equally dangerous case because it implicitly writes the selected package. Compare the
    /// spelling and the resolved spelling so a junction/symlink cannot bypass the boundary.
    /// </summary>
    internal static void EnsureNotOverlappingReadRoots(string full, IEnumerable<string> readRoots)
    {
        foreach (var readRoot in readRoots)
        {
            if (PathsOverlap(full, readRoot) || PathsOverlap(WorkspacePathForm.Canonical(full), WorkspacePathForm.Canonical(readRoot)))
                throw new UnauthorizedAccessException($"Write grant '{full}' overlaps the frozen Skill read root '{readRoot}'.");
        }
    }

    private static bool PathsOverlap(string left, string right) =>
        IsWithinPath(left, right) || IsWithinPath(right, left);

    private static bool IsWithinPath(string root, string path)
    {
        root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(root));
        path = Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
        if (string.Equals(root, path, Cmp)) return true;
        return path.StartsWith(root + Path.DirectorySeparatorChar, Cmp);
    }

    internal static void EnsureNotBroadWriteTarget(string full)
    {
        if (IsDiskRoot(full))
            throw new UnauthorizedAccessException("Disk root is too broad for write authorization.");

        foreach (var broad in ProhibitedBroadTargets)
        {
            if (string.Equals(full, broad, Cmp))
                throw new UnauthorizedAccessException($"'{full}' is too broad for write authorization.");
        }
    }

    internal static bool IsDiskRoot(string full)
    {
        var root = Path.GetPathRoot(full);
        return !string.IsNullOrEmpty(root) && string.Equals(full, root, Cmp);
    }

    private static readonly string[] ProhibitedBroadTargets = BuildProhibited();

    private static string[] BuildProhibited()
    {
        var list = new List<string>(12);
        if (OperatingSystem.IsWindows())
        {
            Add(list, () => Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));
            Add(list, () => Environment.GetFolderPath(Environment.SpecialFolder.Windows));
            Add(list, () => Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles));
            Add(list, () => Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86));
            Add(list, () => Environment.GetFolderPath(Environment.SpecialFolder.System));
            Add(list, () => Environment.GetFolderPath(Environment.SpecialFolder.Personal));
            Add(list, () => Path.GetFullPath(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "..")));
            return list.ToArray();
        }

        // POSIX has no drive root to catch beyond `/`, so the equivalents of "the Windows
        // directory" and "Program Files" have to be named: a persistent write grant on any
        // of these is the system, not the project.
        Add(list, () => Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)); // $HOME
        Add(list, () => Path.GetFullPath(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".."))); // typically /home
        foreach (var p in new[] { "/root", "/usr", "/etc", "/var", "/bin", "/sbin", "/lib", "/opt" })
            list.Add(p);
        return list.ToArray();
    }

    private static void Add(List<string> list, Func<string> path)
    {
        try { var full = Path.TrimEndingDirectorySeparator(Path.GetFullPath(path())); if (!string.IsNullOrEmpty(full)) list.Add(full); }
        catch { }
    }

    // ── capability SID ────────────────────────────────────────────────────────

    private static readonly string WorkspaceRootKey = WorkspacePathResolver.WorkspaceRoot
        .TrimEnd('\\', '/')
        .Replace("\\", "/")
        .ToLowerInvariant();

    [System.Runtime.Versioning.SupportedOSPlatform("windows")]
    internal static SecurityIdentifier DeriveCapabilitySid()
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(WorkspaceRootKey));
        var sid = $"S-1-12-1-{TnadIdentifierAuthority}-{BitConverter.ToUInt32(hash.AsSpan(0))}-{BitConverter.ToUInt32(hash.AsSpan(4))}-{BitConverter.ToUInt32(hash.AsSpan(8))}-{BitConverter.ToUInt32(hash.AsSpan(12))}";
        return new SecurityIdentifier(sid);
    }

    [System.Runtime.Versioning.SupportedOSPlatform("windows")]
    internal static SecurityIdentifier DeriveCapabilitySid(string workspaceRoot)
    {
        var key = workspaceRoot.TrimEnd('\\', '/').Replace("\\", "/").ToLowerInvariant();
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(key));
        var sid = $"S-1-12-1-{TnadIdentifierAuthority}-{BitConverter.ToUInt32(hash.AsSpan(0))}-{BitConverter.ToUInt32(hash.AsSpan(4))}-{BitConverter.ToUInt32(hash.AsSpan(8))}-{BitConverter.ToUInt32(hash.AsSpan(12))}";
        return new SecurityIdentifier(sid);
    }
}
