using System.Collections.Concurrent;
using AsyncLocks;

namespace TinadecTools.Tools.FileRW;

/// <summary>
/// Immutable root set of one tools process: exactly one writable root plus any
/// number of read-only roots. It is a pure value, so the boundary rules can be
/// exercised directly without standing up a process or mutating the environment.
/// </summary>
internal sealed record WorkspaceRootSet(string WritableRoot, IReadOnlyList<string> ReadOnlyRoots)
{
    internal const string ReadOnlyRootsEnvironmentVariable = "TINADEC_TOOLS_READ_ROOTS";

    private static readonly StringComparison PathComparison = OperatingSystem.IsWindows()
        ? StringComparison.OrdinalIgnoreCase
        : StringComparison.Ordinal;

    /// <summary>
    /// The root set of this process: the directory it was started from is the
    /// writable root, and the host may have declared extra readable roots.
    /// </summary>
    public static WorkspaceRootSet FromProcess() => new(
        Normalize(Environment.CurrentDirectory),
        ParseReadOnlyRoots(Environment.GetEnvironmentVariable(ReadOnlyRootsEnvironmentVariable)));

    public static string Normalize(string path) => Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));

    /// <summary>
    /// Parses the host's path-separator separated root list. Entries the writable
    /// root already covers are dropped, and an unusable entry is ignored rather
    /// than failing process startup.
    /// </summary>
    public static IReadOnlyList<string> ParseReadOnlyRoots(string? raw, string? writableRoot = null)
    {
        if (string.IsNullOrWhiteSpace(raw)) return [];
        var root = writableRoot ?? Normalize(Environment.CurrentDirectory);
        var roots = new List<string>();
        foreach (var entry in raw.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            string full;
            try
            {
                full = Normalize(entry);
            }
            catch (Exception ex) when (ex is ArgumentException or NotSupportedException or PathTooLongException)
            {
                continue;
            }

            // The writable root already covers itself and everything inside it.
            if (IsWithin(root, full)) continue;
            if (!roots.Contains(full, StringComparer.OrdinalIgnoreCase)) roots.Add(full);
        }

        return roots;
    }

    /// <summary>
    /// True when the path is inside the writable root, or — for reads only —
    /// inside one of the declared read-only roots.
    /// </summary>
    public bool IsAllowed(string path, bool writable = false) =>
        IsWithin(WritableRoot, path)
        || (!writable && ReadOnlyRoots.Any(root => IsWithin(root, path)));

    /// <summary>
    /// Resolves a path against the writable root (absolute paths pass through) and
    /// refuses anything outside the allowed roots, naming what was attempted and
    /// which roots are allowed so the caller can correct itself.
    /// </summary>
    public string Resolve(string path, bool writable)
    {
        var resolved = Path.GetFullPath(path, WritableRoot);
        if (!IsAllowed(resolved, writable)) throw OutsideWorkspace(path, resolved, writable);
        return resolved;
    }

    /// <summary>The allowed root that contains the path, so link walking starts at that root.</summary>
    public (string Root, string Relative) OwningRoot(string path)
    {
        if (IsWithin(WritableRoot, path)) return (WritableRoot, Path.GetRelativePath(WritableRoot, path));
        foreach (var root in ReadOnlyRoots)
        {
            if (IsWithin(root, path)) return (root, Path.GetRelativePath(root, path));
        }

        return (WritableRoot, Path.GetRelativePath(WritableRoot, path));
    }

    public static bool IsWithin(string root, string path)
    {
        if (string.Equals(path, root, PathComparison))
            return true;

        var prefix = root.EndsWith(Path.DirectorySeparatorChar)
            ? root
            : root + Path.DirectorySeparatorChar;
        return path.StartsWith(prefix, PathComparison);
    }

    public UnauthorizedAccessException OutsideWorkspace(string attempted, string resolved, bool writable)
    {
        var allowed = writable
            ? $"the writable workspace root '{WritableRoot}'"
            : ReadOnlyRoots.Count == 0
                ? $"the workspace root '{WritableRoot}'"
                : $"the workspace root '{WritableRoot}' or a read-only root ({string.Join(", ", ReadOnlyRoots.Select(root => $"'{root}'"))})";
        return new UnauthorizedAccessException(
            $"Path '{attempted}' (resolved to '{resolved}') is outside the allowed workspace. "
            + $"Only paths inside {allowed} may be {(writable ? "written" : "read")}. "
            + "Retry with an absolute path inside the workspace root instead of another location.");
    }
}

/// <summary>
/// Workspace path boundary of one tools process, built on its
/// <see cref="WorkspaceRootSet"/>.
///
/// Absolute paths are the documented contract; a relative path is resolved
/// against the writable root for compatibility. Reads may reach the declared
/// read-only roots, writes never can.
/// </summary>
internal static class WorkspacePathResolver
{
    internal const string ReadOnlyRootsEnvironmentVariable = WorkspaceRootSet.ReadOnlyRootsEnvironmentVariable;

    private static readonly WorkspaceRootSet Roots = WorkspaceRootSet.FromProcess();

    /// <summary>The single writable root: the directory this process was started from.</summary>
    public static string WorkspaceRoot => Roots.WritableRoot;

    /// <summary>Extra roots the host declared readable but never writable (empty by default).</summary>
    public static IReadOnlyList<string> ReadOnlyRoots => Roots.ReadOnlyRoots;

    public static string ResolvePath(string path, bool allowFinalLink = false, bool writable = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);

        var resolved = Roots.Resolve(path, writable);
        EnsureNoLinkTraversal(resolved, allowFinalLink);
        return resolved;
    }

    public static string ResolveDirectory(string path, bool writable = false)
    {
        var resolved = ResolvePath(path, writable: writable);
        if (!Directory.Exists(resolved))
            throw new DirectoryNotFoundException($"Directory '{path}' does not exist.");

        return resolved;
    }

    public static bool IsAllowed(string path, bool writable = false) => Roots.IsAllowed(path, writable);

    public static string ToWorkspaceRelativePath(string path)
    {
        var relative = Path.GetRelativePath(WorkspaceRoot, path);
        return relative == "." ? "." : relative.Replace(Path.DirectorySeparatorChar, '/');
    }

    public static bool IsLink(string path) =>
        (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0;

    public static bool Exists(string path)
    {
        try
        {
            _ = File.GetAttributes(path);
            return true;
        }
        catch (FileNotFoundException)
        {
            return false;
        }
        catch (DirectoryNotFoundException)
        {
            return false;
        }
    }

    private static void EnsureNoLinkTraversal(string path, bool allowFinalLink)
    {
        var (root, relative) = Roots.OwningRoot(path);
        if (relative == ".")
            return;

        var current = root;
        var segments = relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        for (var index = 0; index < segments.Length; index++)
        {
            current = Path.Combine(current, segments[index]);
            if (!Exists(current))
                break;

            if (IsLink(current) && (!allowFinalLink || index < segments.Length - 1))
                throw new UnauthorizedAccessException("Paths through symbolic links or junctions are not allowed.");
        }
    }
}

internal sealed class FileSlot
{
    public AsyncReaderWriterLock RwLock { get; } = new();
}

internal static class FileToolRuntime
{
    private static readonly ConcurrentDictionary<string, FileSlot> Locks = new(
        OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal);

    public static string WorkspaceRoot => WorkspacePathResolver.WorkspaceRoot;

    public static void InitializeWorkspace() => _ = WorkspacePathResolver.WorkspaceRoot;

    public static FileSlot GetFileHandle(string path)
    {
        return Locks.GetOrAdd(path, _ => new FileSlot());
    }

    public static FileAccessor OpenRead(string path, CancellationToken cancellationToken = default) =>
        new(path, canWrite: false, cancellationToken);

    public static FileAccessor OpenWrite(string path, CancellationToken cancellationToken = default) =>
        new(path, canWrite: true, cancellationToken);

    public static string ResolvePath(string filePath, bool writable = false)
    {
        return WorkspacePathResolver.ResolvePath(filePath, writable: writable);
    }
}
