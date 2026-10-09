namespace TinadecCore.Abstractions.Ports;

/// <summary>
/// Provides agent skills via MAF AgentSkillsProvider.
/// Supports file/class/inline skills and SKILL.md format.
/// Script execution delegates to TinadecTools; all writes go through Core approval.
/// </summary>
public interface ISkillProvider
{
    Task<SkillDescriptor[]> ListSkillsAsync(
        string? agentId = null,
        CancellationToken cancellationToken = default);

    Task<SkillDescriptor?> GetSkillAsync(
        string skillId,
        CancellationToken cancellationToken = default);

    /// <summary>Project-scoped discovery for hosts that have a project binding in their context.</summary>
    Task<SkillDescriptor[]> ListSkillsForProjectAsync(
        Guid projectId,
        string? agentId = null,
        CancellationToken cancellationToken = default);

    Task<SkillDescriptor?> GetSkillForProjectAsync(
        string skillId,
        Guid projectId,
        CancellationToken cancellationToken = default);
}

public sealed class SkillDescriptor
{
    public string Id { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string Format { get; init; } = "skill_md";
    public string? AgentId { get; init; }
    public bool RequiresApproval { get; init; }
}
