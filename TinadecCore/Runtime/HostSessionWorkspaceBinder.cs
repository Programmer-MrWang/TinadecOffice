using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Memory;
using TinadecCore.Persistence;

namespace TinadecCore.Runtime;

/// <summary>Approved project creation never mutates the running session's storage binding.</summary>
public sealed class HostSessionWorkspaceBinder(IStorageScopeRegistry registry, ISessionScopeTransferService transfers) : ISessionWorkspaceBinder
{
    public async Task<SessionWorkspaceBinding> BindSessionToWorkspaceAsync(Guid sessionId, string name, string path, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Workspace name is required.");
        if (string.IsNullOrWhiteSpace(path) || !Path.IsPathRooted(path.Trim())) throw new ArgumentException("Workspace path must be absolute.");
        var fullPath = Path.TrimEndingDirectorySeparator(Path.GetFullPath(path.Trim()));
        StorageScopePaths.RejectLinks(fullPath);
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        if (registry.List().Any(scope => fullPath.Equals(scope.Root, comparison)
            || fullPath.StartsWith(Path.TrimEndingDirectorySeparator(scope.Root) + Path.DirectorySeparatorChar, comparison)))
            throw new InvalidOperationException("A workspace cannot be created inside a Core-owned storage directory.");
        await using (var source = await registry.AcquireAsync("user", cancellationToken).ConfigureAwait(false))
        {
            var actor = source.Services.GetRequiredService<ITenantContextAccessor>().Current;
            await using var db = await source.Services.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
            var session = await db.Sessions.AsNoTracking().SingleOrDefaultAsync(s => s.Id == sessionId && s.TenantId == actor.TenantId
                && s.WorkspaceId == actor.WorkspaceId && s.LifecycleStatus == LifecycleStatuses.Active, cancellationToken).ConfigureAwait(false)
                ?? throw new KeyNotFoundException("Active free session was not found.");
            if (session.ProjectId is not null) throw new InvalidOperationException("Only a free session can create a workspace binding.");
        }
        var existed = registry.List().Any(scope => scope.ProjectRoot is not null
            && StorageScopeInitializer.SamePath(scope.ProjectRoot, fullPath));
        Directory.CreateDirectory(fullPath);
        var target = await registry.OpenAsync(new(fullPath, name.Trim()), cancellationToken).ConfigureAwait(false);
        var transfer = await transfers.RequestAsync(sessionId, target.StorageId, cancellationToken).ConfigureAwait(false);
        return new(sessionId, target.ProjectId!.Value, name.Trim(), fullPath, !existed, target.StorageId, transfer.Status);
    }
}

/// <summary>A mounted project cannot grant itself access to the host registry.</summary>
public sealed class ProjectSessionWorkspaceBinder : ISessionWorkspaceBinder
{
    public Task<SessionWorkspaceBinding> BindSessionToWorkspaceAsync(Guid sessionId, string name, string path, CancellationToken cancellationToken = default)
        => throw new InvalidOperationException("Workspace creation is a user-scope host action; this session already belongs to a project.");
}
