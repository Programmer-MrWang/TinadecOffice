using TinadecTools.Tools.FileRW;

namespace TinadecTools.Runtime;

/// <summary>One classification shared by file tools, search and process sandboxes.</summary>
internal static class WorkspaceStoragePolicy
{
    internal static readonly IReadOnlyList<string> InternalDirectories =
        ["data", "state", "logs", "cache", "temp", "packages", "worktrees"];

    internal static string StorageRoot(string workspaceRoot) =>
        ToolExecutionContext.Current?.StorageRoot ?? Path.Combine(workspaceRoot, ".tinadec");

    internal static bool IsPublicScopePath(string workspaceRoot, string path) =>
        new[] { "config", "skills" }.Any(name => WorkspaceRootSet.IsWithin(Path.Combine(StorageRoot(workspaceRoot), name), path));

    internal static bool IsInternal(string workspaceRoot, string path)
    {
        var storageRoot = StorageRoot(workspaceRoot);
        if (!WorkspaceRootSet.IsWithin(storageRoot, path)) return false;
        if (ToolExecutionContext.Current?.WorkingDirectory is { } assigned
            && WorkspaceRootSet.IsWithin(Path.Combine(storageRoot, "worktrees"), assigned)
            && !string.Equals(WorkspaceRootSet.Normalize(assigned), WorkspaceRootSet.Normalize(Path.Combine(storageRoot, "worktrees")),
                OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal)
            && WorkspaceRootSet.IsWithin(assigned, path))
        {
            var nested = Path.Combine(assigned, ".tinadec");
            if (!WorkspaceRootSet.IsWithin(nested, path)) return false;
            var child = Path.GetRelativePath(nested, path).Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)[0];
            return child is not ("." or "config" or "skills");
        }
        var relative = Path.GetRelativePath(storageRoot, path);
        if (relative == ".") return false; // The container may be listed; its children are classified separately.
        var first = relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)[0];
        return !first.Equals("config", StringComparison.OrdinalIgnoreCase)
            && !first.Equals("skills", StringComparison.OrdinalIgnoreCase);
    }

    internal static bool CanAccess(string workspaceRoot, string path, bool writable,
        IReadOnlyList<string> explicitReadRoots)
    {
        if (ForbiddenRoots(workspaceRoot).Any(root => WorkspaceRootSet.IsWithin(root, path)))
            return !writable && !PermanentHostPaths().Any(root => WorkspaceRootSet.IsWithin(root, path))
                && explicitReadRoots.Any(root => WorkspaceRootSet.IsWithin(root, path));
        if (writable && string.Equals(WorkspaceRootSet.Normalize(path), WorkspaceRootSet.Normalize(StorageRoot(workspaceRoot)),
            OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal))
            return ToolExecutionContext.Current?.ProjectStorageWrite == true;
        if (!IsInternal(workspaceRoot, path)) return true;
        if (ToolExecutionContext.Current?.ProjectStorageWrite == true) return true;
        return !writable && explicitReadRoots.Any(root => WorkspaceRootSet.IsWithin(root, path));
    }

    internal static IReadOnlyList<string> ProtectedPaths(string workspaceRoot) =>
        InternalDirectories.Select(name => Path.Combine(StorageRoot(workspaceRoot), name))
            .Append(Path.Combine(StorageRoot(workspaceRoot), "project.toml"))
            .Concat(ToolExecutionContext.Current?.WorkingDirectory is { } assigned
                && WorkspaceRootSet.IsWithin(Path.Combine(StorageRoot(workspaceRoot), "worktrees"), assigned)
                ? InternalDirectories.Select(name => Path.Combine(assigned, ".tinadec", name)).Append(Path.Combine(assigned, ".tinadec", "project.toml")) : [])
            .Concat(ForbiddenRoots(workspaceRoot)).Distinct().ToArray();

    internal static IReadOnlyList<string> ForbiddenRoots(string workspaceRoot)
    {
        var current = StorageRoot(workspaceRoot);
        var roots = (ToolExecutionContext.Current?.ProtectedStorageRoots ?? [])
            .Where(root => !WorkspaceRootSet.IsWithin(root, current)).ToList();
        roots.AddRange(PermanentHostPaths());
        return roots.Distinct().ToArray();
    }
    internal static IReadOnlyList<string> PermanentHostPaths()
    {
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return string.IsNullOrWhiteSpace(home) ? [] : [Path.Combine(home, ".tinadec", "security"), Path.Combine(home, ".tinadec", "state")];
    }
}
