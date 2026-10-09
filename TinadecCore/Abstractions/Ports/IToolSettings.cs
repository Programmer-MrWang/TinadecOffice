using System.Text.Json;
using TinadecCore.Contracts.Dtos;

namespace TinadecCore.Abstractions.Ports;

public interface IToolSettingsStore
{
    JsonElement GetSchema();
    Task<ToolSettingsDocumentDto> GetAsync(Guid? agentDefinitionId = null, CancellationToken cancellationToken = default);
    Task<ToolSettingsDocumentDto> SaveAsync(Guid? agentDefinitionId, JsonElement settings, long expectedRevision, CancellationToken cancellationToken = default, Guid? projectId = null);
    Task<ToolSettingsDocumentDto> ResetAsync(Guid? agentDefinitionId, long expectedRevision, CancellationToken cancellationToken = default);
}

public interface IMcpResourceRegistry
{
    Task<McpResourceCatalogSnapshot> CaptureAsync(Guid? projectId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<McpResourceDto>> ListAsync(Guid? projectId, CancellationToken cancellationToken = default);
    Task<McpResourceDto?> GetAsync(Guid resourceId, CancellationToken cancellationToken = default);
    Task<McpResourceDto> SaveAsync(Guid? resourceId, McpResourceWriteDto input, long expectedRevision, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid resourceId, long expectedRevision, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ToolMcpServerSnapshotDto>> ResolveAsync(Guid? projectId, IReadOnlyList<Guid>? resourceIds, CancellationToken cancellationToken = default);
    Task EnsureImportedAsync(Guid? projectId, CancellationToken cancellationToken = default);
}

public interface IToolSkillCatalog
{
    Task<ToolSkillCatalogSnapshot> CaptureAsync(Guid? projectId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ToolSkillSnapshotDto>> ResolveAsync(Guid? projectId, IReadOnlyList<Guid>? resourceIds, CancellationToken cancellationToken = default);
}

public sealed record McpResourceCatalogSnapshot(IReadOnlyList<McpResourceDto> Resources, IReadOnlyList<ToolMcpServerSnapshotDto> Servers);
public sealed record ToolSkillCatalogSnapshot(IReadOnlyList<ToolSkillResourceDto> Resources, IReadOnlyList<ToolSkillSnapshotDto> Skills);

public interface IToolConfigurationResolver
{
    Task<FrozenToolConfigurationDto> ResolveForRunAsync(Guid? projectId, IReadOnlyList<Guid> agentDefinitionIds, CancellationToken cancellationToken = default);
    Task<ToolExecutionContextDto> ResolveAsync(Guid? projectId, Guid? agentDefinitionId = null, CancellationToken cancellationToken = default);
    Task<ToolExecutionContextDto> ResolveForInspectionAsync(Guid? projectId, Guid? agentDefinitionId = null, CancellationToken cancellationToken = default);
    Task<ToolExecutionContextDto> MaterializeForCallAsync(ToolExecutionContextDto frozen, IReadOnlyList<string> allowedToolIds, CancellationToken cancellationToken = default, string? runId = null, string? toolId = null);
}

public interface IToolExecutionContextLifecycle
{
    Task ReleaseAsync(string runId, CancellationToken cancellationToken = default);
}

public sealed class ToolSettingsException(string code, string message, int statusCode = 400) : Exception(message)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
}
