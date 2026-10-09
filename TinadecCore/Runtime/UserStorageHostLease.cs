using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;

namespace TinadecCore.Runtime;

/// <summary>A host owns one user scope, so a second host cannot recover its live runs as orphans.</summary>
public sealed class UserStorageHostLease : IDisposable
{
    private readonly FileStream _lease;
    public UserStorageHostLease(IScopeStorageLocations scope)
    {
        var path = Path.Combine(scope.State, "host.lock"); StorageScopePaths.RejectLinks(scope.Root, path);
        _lease = new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
    }
    public void Dispose() => _lease.Dispose();
}
