namespace TinadecCore.Abstractions.Ports;

/// <summary>Host session ownership lock shared by admission and cross-scope transfers.</summary>
public interface ISessionStorageAdmissionGuard
{
    Task<IAsyncDisposable> AcquireAsync(Guid sessionId, string storageId, bool startingRun, CancellationToken cancellationToken = default);
}
