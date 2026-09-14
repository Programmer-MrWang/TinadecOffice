namespace TinadecCore.Abstractions;

/// <summary>
/// Single source of truth for durable run error_category values (plan §3.3 item 5).
/// Producers must use these constants instead of ad-hoc string literals; problem
/// details, events, and Desktop presentation key off this taxonomy. The categories
/// that the ad-hoc literals never covered (config / model / protocol) are
/// first-class here so runtime failures can be classified instead of collapsing
/// into "runtime".
/// </summary>
public static class RunErrorTaxonomy
{
    // ── Configuration / model / protocol (previously missing categories) ──
    /// <summary>Provider, route, or workspace misconfiguration discovered at run time.</summary>
    public const string Config = "config";
    /// <summary>Model invocation failed after the route resolved successfully.</summary>
    public const string Model = "model";
    /// <summary>Contract violation between Core and an adapter (unexpected payload/stream shape).</summary>
    public const string Protocol = "protocol";

    // ── Runtime / orchestration ──
    public const string Runtime = "runtime";
    public const string WorkerUnavailable = "worker_unavailable";
    public const string Cancelled = "run_cancelled";

    // ── Task / worker outcomes produced by the run engine ──
    // These were ad-hoc literals inside the engine and the dispatcher, so the
    // vocabulary of record could not classify them (events and UI key off it).
    /// <summary>The worker's authorized declaration surface could not be resolved.</summary>
    public const string ToolManifestUnavailable = "tool_manifest_unavailable";
    /// <summary>Worker resolution/creation failed against the frozen configuration.</summary>
    public const string WorkerAssignmentInvalid = "worker_assignment_invalid";
    /// <summary>The model produced tool arguments that do not match the declaration.</summary>
    public const string InvalidToolArguments = "invalid_tool_arguments";
    /// <summary>The frozen model plan had no usable candidate for this turn.</summary>
    public const string ModelUnavailable = "model_unavailable";
    /// <summary>The worker exceeded the effective max_tool_rounds.</summary>
    public const string ToolRoundLimit = "tool_round_limit";
    /// <summary>The loop guard rejected further tool rounds for this task.</summary>
    public const string ToolLoopDetected = "tool_loop_detected";
    /// <summary>The worker reused a tool call id inside one task.</summary>
    public const string DuplicateToolCall = "duplicate_tool_call";
    /// <summary>Authorization refused the call without a more specific PDP reason code.</summary>
    public const string NotAuthorized = "not_authorized";

    // ── Tools ──
    public const string ToolError = "tool_error";
    public const string ToolTimeout = "timeout";
    public const string ToolProcessExit = "process_exit";
    public const string ToolPrepareFailed = "tool_prepare_failed";
    public const string ToolManifestChanged = "manifest_changed";
    public const string ToolBlocked = "blocked";
    public const string ToolAlreadyRunning = "already_running";
    /// <summary>The provider transport failed before the call was delivered (handshake/startup failure); the call was never sent.</summary>
    public const string ToolRuntimeUnavailable = "tool_runtime_unavailable";

    // ── Approval ──
    public const string ApprovalMissing = "approval_missing";
    public const string ApprovalExpired = "approval_expired";
    public const string ApprovalBindingMismatch = "approval_binding_mismatch";
    public const string NotApproved = "not_approved";
    public const string ApprovalConsumedWithoutOutcome = "approval_consumed_without_outcome";

    // ── Recovery ──
    public const string RecoveryFailed = "recovery_failed";
    public const string OutcomeUnknown = "outcome_unknown";
    public const string SnapshotFailed = "snapshot_failed";
    public const string SnapshotOverride = "snapshot_override";
    public const string RecoveryMarkedFailed = "recovery_marked_failed";

    // ── Authorization ──
    // PDP reason codes that surface as a tool execution's error_category when an
    // authorization boundary refuses the call (GovernanceService.EvaluateBoundaries).
    // They used to be raw strings outside the vocabulary, which is why a denied
    // tool could not be classified in events or in the UI.
    /// <summary>A boundary carried an explicit deny rule for the claim (e.g. the resource envelope).</summary>
    public const string ExplicitDeny = "explicit_deny";
    /// <summary>No boundary denied the claim outright, but none allowed it either.</summary>
    public const string BoundaryNotAllowed = "boundary_not_allowed";
    /// <summary>No authorization boundary was supplied or published for the claim.</summary>
    public const string MissingAuthorizationBoundary = "missing_authorization_boundary";

    private static readonly HashSet<string> Known = new(StringComparer.OrdinalIgnoreCase)
    {
        Config, Model, Protocol, Runtime, WorkerUnavailable, Cancelled,
        ToolManifestUnavailable, WorkerAssignmentInvalid, InvalidToolArguments, ModelUnavailable,
        ToolRoundLimit, ToolLoopDetected, DuplicateToolCall, NotAuthorized,
        ToolError, ToolTimeout, ToolProcessExit, ToolPrepareFailed, ToolManifestChanged, ToolBlocked, ToolAlreadyRunning, ToolRuntimeUnavailable,
        ApprovalMissing, ApprovalExpired, ApprovalBindingMismatch, NotApproved, ApprovalConsumedWithoutOutcome,
        RecoveryFailed, OutcomeUnknown, SnapshotFailed, SnapshotOverride, RecoveryMarkedFailed,
        ExplicitDeny, BoundaryNotAllowed, MissingAuthorizationBoundary
    };

    /// <summary>All well-known categories (vocabulary of record).</summary>
    public static IReadOnlyCollection<string> KnownCategories => Known;

    public static bool IsKnown(string? category) => !string.IsNullOrWhiteSpace(category) && Known.Contains(category);
}
