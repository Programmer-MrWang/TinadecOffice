namespace TinadecCore.Abstractions.Ports;

/// <summary>
/// A user's composable choices for the next spatial task. These are captured with
/// the submitted message and frozen at admission; changing the session never
/// changes an admitted run. Flat conversations use their published preset instead.
/// </summary>
public sealed record SpaceRunOptions(
    bool PlanFirst = false,
    bool SpecEnabled = false,
    bool MultiAgent = false,
    Guid? WorkflowModeVersionId = null,
    bool BulletinBoard = false,
    bool Worktree = false);
