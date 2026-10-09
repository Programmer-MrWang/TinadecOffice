namespace TinadecCore.Abstractions.Ports;

/// <summary>
/// Registers a project workspace and requests a host-coordinated transfer of a free
/// session. The current run keeps its original scope until it is terminal. Used by
/// the Core-owned create_workspace virtual tool after its approval gate has passed.
/// </summary>
public interface ISessionWorkspaceBinder
{
    Task<SessionWorkspaceBinding> BindSessionToWorkspaceAsync(Guid sessionId, string name, string path, CancellationToken cancellationToken = default);
}

public sealed record SessionWorkspaceBinding(
    Guid SessionId,
    Guid ProjectId,
    string ProjectName,
    string RootPath,
    bool ProjectCreated,
    string? StorageId = null,
    string? TransferStatus = null);
