using System.Security.Cryptography;
using System.Text;
using TinadecCore.Abstractions.Ports;

namespace TinadecCore.Lifecycle;

/// <summary>One bounded snapshot with root-qualified references and provider state for every source.</summary>
internal sealed class WorkspaceBundleSnapshotProvider(IWorkspaceDefinitionProvider workspace,
    IReadOnlyList<IWorkspaceSnapshotProvider> providers, IScopeStorageLocations locations) : IWorkspaceSnapshotProvider
{
    public string Kind => "workspace";
    public bool CanHandle(string workspaceRoot) => Directory.Exists(workspaceRoot);
    private string Anchor => locations.ProjectRoot!;
    private IWorkspaceSnapshotProvider Provider(string path, string? kind = null) => providers.FirstOrDefault(provider =>
        (kind is null || provider.Kind == kind) && provider.CanHandle(path)) ?? throw new InvalidOperationException("Source folder snapshot provider is unavailable: " + path);

    public async Task<WorkspaceSnapshotDocument> CaptureAsync(WorkspaceSnapshotCaptureRequest request, CancellationToken ct = default)
    {
        var roots = request.SourceRoots ?? workspace.Read(requireAvailable: true).Roots;
        var historical = workspace.ReadHistoricalRoots();
        foreach (var root in roots)
            if (!historical.Any(granted => granted.Id == root.Id && SamePath(granted.Path, root.Path)))
                throw new UnauthorizedAccessException("Snapshot source folder has no host grant: " + root.Id);
        var snapshots = new List<WorkspaceSnapshotRoot>();
        var files = new List<WorkspaceSnapshotFile>();
        var remaining = request.MaxBytes;
        foreach (var root in roots)
        {
            if (files.Count >= request.MaxFiles) throw new InvalidOperationException("Workspace snapshot file limit reached.");
            var snapshot = await Provider(root.Path).CaptureAsync(request with { WorkspaceRoot = root.Path, SourceRoots = null,
                MaxFiles = request.MaxFiles - files.Count, MaxBytes = Math.Max(1, remaining) }, ct).ConfigureAwait(false);
            if (remaining <= 0) snapshot = snapshot with { Files = snapshot.Files.Select(file => file with { ContentBase64 = null }).ToArray() };
            snapshots.Add(new(root.Id, Path.GetRelativePath(Anchor, root.Path).Replace('\\', '/'), snapshot));
            files.AddRange(snapshot.Files.Select(file => file with { Path = root.Id + "/" + file.Path, RootId = root.Id, RelativePath = file.Path }));
            remaining -= snapshot.Files.Where(file => file.ContentBase64 is not null).Sum(file => file.Length);
        }
        var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("\n", snapshots.OrderBy(root => root.Id, StringComparer.Ordinal)
            .Select(root => root.Id + "\0" + root.RelativePath + "\0" + root.Snapshot.WorkspaceHash)))));
        return new(3, Kind, snapshots.Any(root => root.Snapshot.IsGit), request.IncludeHidden, hash, files, Roots: snapshots);
    }

    internal IReadOnlyList<WorkspaceSourceRoot> AuthorizedSources(WorkspaceSnapshotDocument snapshot)
    {
        var historical = workspace.ReadHistoricalRoots();
        return (snapshot.Roots ?? throw new InvalidDataException("Workspace snapshot has no roots.")).Select(root => {
            var path = Path.GetFullPath(root.RelativePath, Anchor);
            if (!historical.Any(granted => granted.Id == root.Id && SamePath(granted.Path, path)))
                throw new UnauthorizedAccessException("Snapshot source folder has no historical host grant: " + root.Id);
            if (!Directory.Exists(path)) throw new DirectoryNotFoundException("Snapshot source folder is unavailable: " + path);
            return new WorkspaceSourceRoot(root.Id, path);
        }).ToArray();
    }

    public async Task<WorkspaceSnapshotProviderRestoreResult> RestoreAsync(string workspaceRoot, WorkspaceSnapshotDocument snapshot,
        WorkspaceSnapshotProviderRestoreRequest request, CancellationToken ct = default)
    {
        var roots = AuthorizedSources(snapshot);
        var current = await CaptureAsync(new(workspaceRoot, snapshot.IncludeHidden, 100_000, 1024L * 1024 * 1024, roots), ct).ConfigureAwait(false);
        var expected = request.ExpectedWorkspaceHash ?? snapshot.WorkspaceHash;
        if (current.WorkspaceHash != expected && !request.AllowConflicts)
            throw new WorkspaceSnapshotConflictException("Workspace changed after the snapshot was reviewed.", ["workspace_hash"]);
        // Preflight all sources before any source is restored.
        foreach (var root in snapshot.Roots!)
            foreach (var file in root.Snapshot.Files.Where(file => file.ContentBase64 is null))
                if (!current.Roots!.Single(source => source.Id == root.Id).Snapshot.Files.Any(live => live.Path == file.Path && live.Sha256 == file.Sha256))
                    throw new WorkspaceSnapshotConflictException("Snapshot file content is unavailable.", [root.Id + "/" + file.Path]);
        var applied = 0;
        foreach (var root in snapshot.Roots!)
        {
            var path = roots.Single(source => source.Id == root.Id).Path;
            var currentHash = current.Roots!.Single(source => source.Id == root.Id).Snapshot.WorkspaceHash;
            var result = await Provider(path, root.Snapshot.ProviderKind).RestoreAsync(path, root.Snapshot,
                new(currentHash, request.AllowConflicts), ct).ConfigureAwait(false);
            applied += result.AppliedFileCount;
        }
        return new("restored", snapshot.WorkspaceHash, [], applied);
    }
    private static bool SamePath(string left, string right) => string.Equals(WorkspacePathSpelling.Canonical(left), WorkspacePathSpelling.Canonical(right),
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
}
