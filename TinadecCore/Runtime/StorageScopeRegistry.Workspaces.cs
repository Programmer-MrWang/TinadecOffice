using TinadecCore.Abstractions.Ports;
using TinadecCore.Memory;
using TinadecCore.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace TinadecCore.Runtime;

public sealed partial class StorageScopeRegistry
{
    public WorkspaceDefinition ReadWorkspace(string storageId, bool requireAvailable = false)
    {
        var registration = GetRegistration(storageId);
        var definition = WorkspaceDefinitionFile.Read(registration.Scope, registration.Name);
        var granted = new WorkspaceDefinition(registration.Name,
            registration.Roots ?? [new("primary", registration.Scope.ProjectRoot!)], registration.PrimaryRootId ?? "primary");
        RequireSameRoots(definition, granted);
        return WorkspaceDefinitionFile.Validate(definition, requireAvailable);
    }

    public WorkspacePreview PreviewWorkspace(string projectPath)
    {
        var path = StorageScopePaths.NormalizeProjectRoot(projectPath);
        var registered = _registrations.Values.FirstOrDefault(x => x.OwnerPrincipalId == _identity.PrincipalId
            && (StorageScopeInitializer.SamePath(x.Scope.ProjectRoot!, path)
                || (x.Roots ?? []).Any(root => StorageScopeInitializer.SamePath(root.Path, path))));
        if (registered is not null)
            return new(true, registered.Scope.ProjectRoot!, registered.Scope.StorageId, registered.Scope.Root,
                WorkspaceDefinitionFile.Read(registered.Scope, registered.Name));
        var root = Path.Combine(path, ".tinadec");
        if (!Directory.Exists(root) && !File.Exists(root)) return new(false, path, null, null, null);
        var scope = StorageScopeInitializer.ReadManifest("preview", path, root);
        return new(true, path, null, root, WorkspaceDefinitionFile.Read(scope, Path.GetFileName(path)));
    }

    public async Task<WorkspaceDefinition> EditWorkspaceAsync(string storageId, WorkspaceEditRequest request,
        string expectedHash, CancellationToken ct = default)
    {
        var definition = WorkspaceDefinitionFile.Validate(new(request.Name, request.Roots, request.PrimaryRootId, request.Icon, request.Color));
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            var registration = GetRegistration(storageId);
            var priorRoots = HistoricalRoots(registration);
            if (definition.Roots.Any(root => priorRoots.Any(previous => previous.Id == root.Id)
                && !priorRoots.Any(previous => previous.Id == root.Id && StorageScopeInitializer.SamePath(previous.Path, root.Path))))
                throw new ArgumentException("Changing a source folder path requires a new folder ID. Remove its reference and add the new folder.");
            foreach (var root in definition.Roots)
                if (List().Any(scope => IsWithinStorage(scope.Root, root.Path)))
                    throw new ArgumentException("A source folder cannot be inside product storage: " + root.Path);
            var file = WorkspaceDefinitionFile.FilePath(registration.Scope);
            StorageScopePaths.RejectLinks(registration.Scope.Root, file);
            await using var writeLease = await WorkspaceDefinitionFile.AcquireWriteLeaseAsync(registration.Scope, ct).ConfigureAwait(false);
            var original = await File.ReadAllTextAsync(file, ct).ConfigureAwait(false);
            if (WorkspaceDefinitionFile.Hash(original) != expectedHash)
                throw new ConfigurationDocumentException("configuration_conflict", "project.toml changed. Reload the workspace before saving.",
                    [new("workspace_conflict", file)]);
            var text = WorkspaceDefinitionFile.Write(original, definition, registration.Scope.ProjectRoot!);
            // The manifest publishes first. Until the host grants publish, new admission fails
            // closed. A crash in between requires an explicit host open to rebind the roots.
            await WorkspaceDefinitionFile.WriteIfMatchAsync(registration.Scope, text, expectedHash, ct).ConfigureAwait(false);
            try
            {
                _registrations[storageId] = registration with { Name = definition.Name, Roots = definition.Roots, PrimaryRootId = definition.PrimaryRootId,
                    HistoricalRoots = MergeHistory(priorRoots, definition.Roots) };
                await SaveRegistrationsAsync(ct).ConfigureAwait(false);
            }
            catch
            {
                _registrations[storageId] = registration;
                if (WorkspaceDefinitionFile.Hash(await File.ReadAllTextAsync(file, CancellationToken.None).ConfigureAwait(false)) == WorkspaceDefinitionFile.Hash(text))
                    await AtomicWriteAsync(file, original, CancellationToken.None).ConfigureAwait(false);
                throw;
            }
            definition = definition with { ContentHash = WorkspaceDefinitionFile.Hash(text) };
            // The database is a rebuildable projection; existing runs use their frozen envelope.
            if (_runtimes.TryGetValue(storageId, out var runtime))
            {
                var store = runtime.Provider.GetRequiredService<ProjectSessionStore>();
                await store.RebindProjectRootAsync(registration.Scope.ProjectId!.Value, definition.PrimaryPath, ct).ConfigureAwait(false);
                await store.RenameProjectAsync(registration.Scope.ProjectId.Value, definition.Name, ct).ConfigureAwait(false);
            }
            return definition;
        }
        finally { _gate.Release(); }
    }

    private static bool IsWithinStorage(string storage, string path) => StorageScopeInitializer.SamePath(storage, path)
        || Path.GetFullPath(path).StartsWith(Path.TrimEndingDirectorySeparator(Path.GetFullPath(storage)) + Path.DirectorySeparatorChar,
            OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);

    private static void RequireSameRoots(WorkspaceDefinition definition, WorkspaceDefinition granted)
    {
        if (definition.PrimaryRootId != granted.PrimaryRootId || definition.Roots.Count != granted.Roots.Count
            || definition.Roots.Any(root => !granted.Roots.Any(allowed => allowed.Id == root.Id
                && StorageScopeInitializer.SamePath(allowed.Path, root.Path))))
            throw new ConfigurationDocumentException("workspace_authorization_required",
                "Workspace folders differ from the host authorization. Open or edit the workspace through the desktop to grant them.",
                [new("workspace_roots", "project.toml: workspace.roots / workspace.primary_root_id")]);
    }

    private static void RequireSelectedRoots(WorkspaceDefinition definition, WorkspaceDefinition selected, bool explicitRoots, string selectedPath)
    {
        // Legacy single-folder callers grant the selected path, not an invented root ID.
        if (!explicitRoots && definition.Roots.Count == 1 && StorageScopeInitializer.SamePath(definition.PrimaryPath, selectedPath)) return;
        RequireSameRoots(definition, selected);
    }

    private static IReadOnlyList<WorkspaceSourceRoot> HistoricalRoots(Registration registration) => registration.HistoricalRoots
        ?? registration.Roots ?? [new("primary", registration.Scope.ProjectRoot!)];

    private static IReadOnlyList<WorkspaceSourceRoot> MergeHistory(IReadOnlyList<WorkspaceSourceRoot> history, IReadOnlyList<WorkspaceSourceRoot> roots)
        => history.Concat(roots).DistinctBy(root => (root.Id, WorkspacePathSpelling.Canonical(root.Path)), new RootHistoryComparer()).ToArray();

    private sealed class RootHistoryComparer : IEqualityComparer<(string Id, string Path)>
    {
        private static StringComparer Paths => OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal;
        public bool Equals((string Id, string Path) x, (string Id, string Path) y) => x.Id == y.Id && Paths.Equals(x.Path, y.Path);
        public int GetHashCode((string Id, string Path) obj) => HashCode.Combine(obj.Id, Paths.GetHashCode(obj.Path));
    }

    private sealed class RegisteredWorkspace(StorageScopeRegistry registry, string storageId) : IWorkspaceDefinitionProvider
    {
        public WorkspaceDefinition Read(bool requireAvailable = false) => registry.ReadWorkspace(storageId, requireAvailable);
        public IReadOnlyList<WorkspaceSourceRoot> ReadHistoricalRoots() => HistoricalRoots(registry.GetRegistration(storageId));
    }
}
