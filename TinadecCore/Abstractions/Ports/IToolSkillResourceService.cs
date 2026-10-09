using TinadecCore.Contracts.Dtos;

namespace TinadecCore.Abstractions.Ports;

public interface IToolSkillResourceService
{
    Task<ToolSkillListDto> ListAsync(Guid? projectId, CancellationToken cancellationToken = default);
    Task<ToolSkillResourceDto?> GetAsync(Guid resourceId, Guid? projectId, CancellationToken cancellationToken = default);
    Task<ToolSkillFileDto?> GetFileAsync(Guid resourceId, Guid? projectId, string relativePath, CancellationToken cancellationToken = default);
    Task<ToolSkillResourceDto> SaveAsync(Guid? resourceId, Guid? projectId, ToolSkillWriteDto input, long expectedRevision, CancellationToken cancellationToken = default);
    Task<ToolSkillResourceDto> RequestSaveAsync(Guid? resourceId, Guid? projectId, ToolSkillWriteDto input, long expectedRevision, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid resourceId, Guid? projectId, long expectedRevision, CancellationToken cancellationToken = default);
    Task<ToolSkillResourceDto> RequestDeleteAsync(Guid resourceId, Guid? projectId, long expectedRevision, CancellationToken cancellationToken = default);
}

