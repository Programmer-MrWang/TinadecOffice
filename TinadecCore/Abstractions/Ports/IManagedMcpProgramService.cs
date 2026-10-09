using TinadecCore.Contracts.Dtos;

namespace TinadecCore.Abstractions.Ports;

/// <summary>Registration is configuration; program installation is an explicit approved operation.</summary>
public interface IManagedMcpProgramService
{
    Task<ManagedMcpProgramPreviewDto> PreviewAsync(Guid resourceId, Guid? projectId, string action, CancellationToken cancellationToken = default);
    Task<UserToolActionResult> RequestApplyAsync(ManagedMcpProgramPreviewDto preview, CancellationToken cancellationToken = default);
    Task<ManagedMcpProgramResultDto> ApplyApprovedAsync(ManagedMcpProgramPreviewDto preview, CancellationToken cancellationToken = default);
    Task<ToolMcpServerSnapshotDto> ResolveForExecutionAsync(ToolMcpServerSnapshotDto resource, CancellationToken cancellationToken = default);
}
