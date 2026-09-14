using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;

namespace TinadecCore.DmaEA;

/// <summary>
/// Resolves the configuration for a new run exactly once. The returned value is a
/// self-contained document: execution code must never consult the hot-reload store
/// after admission.
/// </summary>
public interface IAgentRuntimeConfigurationResolver
{
    Task<FrozenRunConfigurationV1> ResolveAsync(
        Guid sessionId,
        string? applicationMode,
        string? agentMode,
        string? permissionMode,
        SessionModelOverride? meetingModelOverride = null,
        CancellationToken cancellationToken = default);
}

public sealed record FrozenRuntimeOverride(
    Guid Id,
    int Version,
    string ContentHash,
    DateTimeOffset CreatedAt);

/// <summary>
/// Version one is deliberately explicit rather than retaining a pointer to the
/// mutable TOML document. Secrets are represented only by external version ids.
/// </summary>
public sealed record FrozenRunConfigurationV1(
    string SchemaVersion,
    string BaselineHash,
    long BaselineVersion,
    string ApplicationMode,
    string AgentMode,
    string RuntimeProfileId,
    string PermissionMode,
    SpawnPolicy Spawn,
    SchedulingPolicy Scheduling,
    SupervisionPolicy Supervision,
    ContextPolicy Context,
    MemoryPolicy Memory,
    ToolRuntimePolicy Tools,
    IReadOnlyList<RuntimeAgentDefinition> OperationAgents,
    IReadOnlyList<RuntimeAgentDefinition> ExecutionAgents,
    FrozenRuntimeOverride? WorkspaceOverride,
    IReadOnlyList<RunConfigurationBinding> Bindings,
    string ToolManifestHash = "")
{
    /// <summary>
    /// The v2 tool declarations authorized at admission.  This is a content
    /// snapshot, not a live registry reference; workers must derive declarations
    /// from it and may never expand a wildcard against a later manifest.
    /// </summary>
    public IReadOnlyList<FrozenToolManifestEntry> ToolManifest { get; init; } = [];

    /// <summary>Protocol version of <see cref="ToolManifest"/> (zero for legacy bodies).</summary>
    public int ToolManifestProtocolVersion { get; init; }

    /// <summary>
    /// Policy versions captured at admission.  An empty list is meaningful when
    /// <see cref="PolicySnapshotHash"/> is populated: it means the run admitted
    /// with no active policy bundles, rather than asking Governance to reload the
    /// current policy set later.
    /// </summary>
    public string PolicySnapshotHash { get; init; } = "";
    public IReadOnlyList<FrozenPolicyBundle> PolicyBundles { get; init; } = [];

    /// <summary>
    /// Operational-role trigger gates frozen at admission. Runs admitted before
    /// the trigger chain existed deserialize with the disabled default.
    /// </summary>
    public TriggersPolicy Triggers { get; init; } = TriggersPolicy.Disabled;

    /// <summary>
    /// Lane master switch and ceilings frozen at admission. Runs admitted before
    /// the orchestration section existed deserialize with lanes disabled, so an
    /// old checkpoint resumes with the pre-lane single-lane semantics.
    /// </summary>
    public OrchestrationPolicy Orchestration { get; init; } = OrchestrationPolicy.Disabled;

    /// <summary>
    /// Declared mode graph frozen at admission (DmaEA graph orchestration).
    /// Schema v2 freezes a Graph section for EVERY mode: free_form (no declared
    /// edges) is itself a tier and its single-director shape is enforced by the
    /// engine. The tier is derived ONLY from frozen inputs at admission; recovery
    /// never re-derives it. (v1 freezes omitted this section for edge-less modes;
    /// the v1→v2 clean break supersedes those bodies — recovery fail-closes with
    /// run_schema_superseded instead of double-reading.)
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public FrozenGraph? Graph { get; init; }

    /// <summary>
    /// The workspace this run is bound to, frozen at admission (root absolute
    /// path, extra read-only roots, git facts, top-level listing, path contract).
    /// Null means "this run has no workspace": projectless free-conversation
    /// sessions, and every body frozen before the section existed. Recovery treats
    /// a missing section as no workspace rather than failing the schema gate, and
    /// it never re-resolves the binding — the model prompt and the tool boundary
    /// both read this section as the single authority for "where am I".
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public FrozenWorkspaceBinding? Workspace { get; init; }

    /// <summary>
    /// The frozen-body schema this Core writes and reads. v2 introduced the
    /// always-present Graph section (free_form tier on disk) and spawnable
    /// templates; v1 bodies are superseded and fail closed on resume.
    /// </summary>
    public const string CurrentSchemaVersion = "frozen-run-configuration/v2";

    public string ToCanonicalJson() => JsonSerializer.Serialize(this, JsonOptions);

    [JsonIgnore]
    public string ContentHash => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(ToCanonicalJson()))).ToLowerInvariant();

    public FrozenRunConfigurationWrite ToLifecycleWrite() => new(
        SchemaVersion,
        ToCanonicalJson(),
        Bindings);

    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false
    };
}

/// <summary>Enforcement tiers for the declared-graph orchestration. The tier decides which dispatch/spawn authority the engine consults; it is derived only at admission.</summary>
public static class FrozenGraphTiers
{
    /// <summary>Declared edges walked; conversation identity holds no dispatchable-worker spawn authority (or holds only agent.create_persistent). Spawn intent is denied (graph_tier_spawn_denied).</summary>
    public const string Deterministic = "deterministic";

    /// <summary>Declared edges walked; conversation identity holds agent.create_temporary (or the agent.spawn alias) and may additionally spawn workers from the frozen spawnable-template whitelist.</summary>
    public const string SelfDispatch = "self_dispatch";

    /// <summary>No declared dispatch edges — single-director free-form orchestration; the director spawns workers from the frozen spawnable-template set and edges are prompt material only.</summary>
    public const string FreeForm = "free_form";
}

/// <summary>
/// The frozen declared graph of the session's published mode. Edges are a
/// communication topology, not a DAG — mutual dispatch/result pairs are legal.
/// </summary>
public sealed record FrozenGraph(
    string Tier,
    string? ConversationTemplateSlug,
    string? ConversationNodeKey,
    IReadOnlyList<FrozenGraphNode> Nodes,
    IReadOnlyList<DeclaredGraphEdge> Edges)
{
    /// <summary>
    /// Worker templates the conversation identity may spawn outside the declared
    /// roster (self_dispatch whitelist; free_form director's buildable set),
    /// hash-pinned at admission with their tool ceiling already intersected
    /// against the frozen tool manifest.
    /// </summary>
    public IReadOnlyList<FrozenSpawnableTemplate> SpawnableTemplates { get; init; } = [];
}

public sealed record FrozenGraphNode(string NodeKey, string AgentSlug, string Layer, bool IsConversation)
{
    /// <summary>Workspace-relative path grants frozen from the node's binding envelope resources (empty = deny path-targeting tools; WS-4 resource envelope).</summary>
    public IReadOnlyList<FrozenResourceGrant> ResourceGrants { get; init; } = [];
}

/// <summary>A worker template the conversation identity may spawn, with its frozen tool ceiling.</summary>
public sealed record FrozenSpawnableTemplate(
    string Slug,
    Guid AgentDefinitionId,
    Guid AgentVersionId,
    string VersionHash,
    string Role,
    IReadOnlyList<string> ToolCeiling,
    IReadOnlyList<string> Capabilities)
{
    /// <summary>Workspace-relative path grants frozen from the template's binding envelope resources (empty = no workspace authorization).</summary>
    public IReadOnlyList<FrozenResourceGrant> ResourceGrants { get; init; } = [];
}

internal sealed class AgentRuntimeConfigurationResolver : IAgentRuntimeConfigurationResolver
{
    private readonly IAgentRuntimeConfiguration _baseline;
    private readonly IDbContextFactory<AgentControlDbContext> _agents;
    private readonly IFormalModeResolver _formal;
    private readonly IAgentModelResolver _models;
    private readonly IContentStore _content;
    private readonly ISessionLocator _sessions;
    private readonly IPolicySnapshotProvider? _policySnapshots;

    public AgentRuntimeConfigurationResolver(
        IAgentRuntimeConfiguration baseline,
        IDbContextFactory<AgentControlDbContext> agents,
        IFormalModeResolver formal,
        IAgentModelResolver models,
        IContentStore content,
        ISessionLocator sessions,
        IPolicySnapshotProvider? policySnapshots = null)
    {
        _baseline = baseline;
        _agents = agents;
        _formal = formal;
        _models = models;
        _content = content;
        _sessions = sessions;
        _policySnapshots = policySnapshots;
    }

    public async Task<FrozenRunConfigurationV1> ResolveAsync(
        Guid sessionId,
        string? applicationMode,
        string? agentMode,
        string? permissionMode,
        SessionModelOverride? meetingModelOverride = null,
        CancellationToken cancellationToken = default)
    {
        var session = await _sessions.FindAsync(sessionId, cancellationToken).ConfigureAwait(false)
            ?? throw new KeyNotFoundException("Session was not found.");
        if (session.ModeVersionId is null)
            throw new RunAdmissionException("agent_mode_not_configured", "A published default Agent Mode must be configured before creating a run.");
        // The workspace is resolved exactly once, here, from Core-owned records and
        // a cheap filesystem probe. Everything downstream (prompt, tool boundary,
        // resource claims) reads the frozen section instead of re-resolving it.
        var workspace = await WorkspaceBindingFactory.TryCreateAsync(_sessions, session, cancellationToken).ConfigureAwait(false);
        var snapshot = _baseline.Current;
        var (app, mode, profile) = snapshot.Resolve(applicationMode, agentMode);
        var policySnapshot = _policySnapshots is null
            ? null
            : await _policySnapshots.CaptureAsync(session.TenantId, session.WorkspaceId, cancellationToken).ConfigureAwait(false);

        var overrideRow = await LoadLatestOverrideAsync(session, profile.Id, cancellationToken).ConfigureAwait(false);
        var effective = overrideRow is null
            ? new EffectivePolicy(snapshot.Spawn, snapshot.Scheduling, snapshot.Supervision, snapshot.Context, snapshot.Memory, snapshot.Tools, profile)
            : await ApplyOverrideAsync(snapshot, profile, overrideRow, cancellationToken).ConfigureAwait(false);

        // Policy budgets remain in the runtime baseline. Agent identity and topology
        // are always frozen from the session's published relational ModeVersion.
        var bindings = new List<RunConfigurationBinding>
        {
            // The TOML baseline itself has no relational version. A deterministic id
            // makes it visible to lifecycle audit without inventing a mutable record.
            new("agent_runtime_baseline", DeterministicGuid(snapshot.ContentHash), DeterministicGuid(snapshot.ContentHash + ":" + snapshot.Version), snapshot.ContentHash)
        };
        var modeVersionId = session.ModeVersionId.Value;
        var relational = await _formal.ResolveRosterAsync(sessionId, cancellationToken).ConfigureAwait(false)
            ?? throw new InvalidDataException($"Agent mode version '{modeVersionId}' could not be resolved.");
        var operation = relational.Operation.Select(ToRuntimeAgentDefinition).ToArray();
        var execution = relational.Execution.Select(ToRuntimeAgentDefinition).ToArray();
        operation = (await FreezeModelPlansAsync(operation, sessionId, modeVersionId, session.ConversationTemplateSlug, meetingModelOverride, cancellationToken).ConfigureAwait(false)).ToArray();
        execution = (await FreezeModelPlansAsync(execution, sessionId, modeVersionId, session.ConversationTemplateSlug, meetingModelOverride, cancellationToken).ConfigureAwait(false)).ToArray();

        // Workspace baseline: a bound workspace gives every agent that holds a
        // provider tool face the whole-root read level, so read-only work never
        // fails for "no workspace authorization". An envelope that declared
        // grants keeps them verbatim (narrowing only), and write stays
        // envelope-declared plus approval-gated.
        operation = operation.Select(agent => agent with
        {
            ResourceGrants = WorkspaceGrantDefaults.Resolve(workspace, agent.ResourceGrants, agent.AllowedTools)
        }).ToArray();
        execution = execution.Select(agent => agent with
        {
            ResourceGrants = WorkspaceGrantDefaults.Resolve(workspace, agent.ResourceGrants, agent.AllowedTools)
        }).ToArray();

        // Declared graph freeze (DmaEA graph orchestration): every mode freezes a
        // Graph section under schema v2 — free_form is a tier on disk, not the
        // absence of one. The tier is derived ONLY here from frozen inputs;
        // recovery never re-derives it (configuration.Graph is the single
        // authority). Spawnable tool ceilings are finished in the coordinator's
        // manifest freeze (the execution ceiling is not resolvable here yet).
        var grantsBySlug = operation.Concat(execution)
            .GroupBy(agent => agent.Id, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().ResourceGrants, StringComparer.OrdinalIgnoreCase);
        var graph = new FrozenGraph(
            DeriveGraphTier(operation, relational.HasDeclaredEdges, relational.ConversationTemplateSlug),
            relational.ConversationTemplateSlug,
            relational.ConversationNodeKey,
            relational.GraphNodes.Select(node => new FrozenGraphNode(
                node.NodeKey,
                node.AgentSlug,
                node.Layer,
                string.Equals(node.NodeKey, relational.ConversationNodeKey, StringComparison.Ordinal))
            {
                ResourceGrants = grantsBySlug.TryGetValue(node.AgentSlug, out var grants) ? grants : []
            }).ToArray(),
            relational.Edges)
        {
            SpawnableTemplates = relational.SpawnableTemplates.Select(template => new FrozenSpawnableTemplate(
                template.Slug,
                template.AgentDefinitionId,
                template.AgentVersionId,
                template.VersionHash,
                template.Role,
                template.ToolScope,
                template.Capabilities)
            {
                ResourceGrants = WorkspaceGrantDefaults.Resolve(workspace, template.ResourceGrants, template.ToolScope)
            }).ToArray()
        };

        // Gate 3 (run freeze): conversation identity lock + operation deny floor,
        // fail-closed at admission. Sessions frozen before ConversationIdentity
        // existed keep the legacy literal-meeting semantics (null identity).
        RunFreezeGate.Validate(
            session.ConversationNodeKey is null
                ? null
                : new RunFreezeGate.ConversationIdentity(session.ConversationNodeKey, session.ConversationTemplateSlug ?? string.Empty),
            operation,
            execution,
            graph,
            snapshot.Orchestration.LanesEnabled);

        var runtimeProfileId = relational.RuntimeProfileId;
        bindings.Add(new RunConfigurationBinding("agent_mode_version", relational.AgentModeId, relational.ModeVersionId, relational.TopologyHash ?? ""));
        foreach (var agent in relational.Operation.Concat(relational.Execution))
        {
            if (agent.AgentDefinitionId is { } definitionId && agent.AgentVersionId is { } versionId)
            {
                bindings.Add(new RunConfigurationBinding("agent_version", definitionId, versionId, agent.VersionContentHash));
            }
            if (agent.PromptPipelineId is { } pipelineId && agent.PromptVersionId is { } promptVersionId)
            {
                if (!bindings.Any(binding => binding.ConfigurationKind == "prompt_version" && binding.ConfigurationVersionId == promptVersionId))
                {
                    bindings.Add(new RunConfigurationBinding("prompt_version", pipelineId, promptVersionId, agent.PromptVersionContentHash));
                }
            }
        }
        FrozenRuntimeOverride? frozenOverride = null;
        if (overrideRow is not null)
        {
            bindings.Add(new RunConfigurationBinding("workspace_runtime_override", overrideRow.Id, DeterministicGuid(overrideRow.Id + ":" + overrideRow.Version), overrideRow.ContentHash));
            frozenOverride = new FrozenRuntimeOverride(overrideRow.Id, overrideRow.Version, overrideRow.ContentHash, overrideRow.CreatedAt);
        }

        var frozen = new FrozenRunConfigurationV1(
            FrozenRunConfigurationV1.CurrentSchemaVersion,
            snapshot.ContentHash,
            snapshot.Version,
            app,
            mode,
            runtimeProfileId,
            NormalizePermissionMode(permissionMode),
            effective.Spawn,
            effective.Scheduling,
            effective.Supervision,
            effective.Context,
            effective.Memory,
            effective.Tools,
            operation,
            execution,
            frozenOverride,
            bindings)
        {
            PolicySnapshotHash = policySnapshot?.SnapshotHash ?? "",
            PolicyBundles = policySnapshot?.Bundles ?? [],
            Triggers = snapshot.Triggers,
            Orchestration = snapshot.Orchestration,
            Graph = graph,
            Workspace = workspace
        };
        return frozen;
    }

    /// <summary>
    /// Three-branch tier derivation, decided only from frozen inputs:
    /// no declared dispatch edges → free_form (the director builds its own
    /// workers); declared edges + a conversation identity holding a
    /// dispatchable-worker spawn authority (agent.create_temporary, or the
    /// agent.spawn alias) → self_dispatch; declared edges without spawn
    /// authority (including create_persistent-only, which mints candidates not
    /// dispatchable workers) → deterministic.
    /// </summary>
    internal static string DeriveGraphTier(IReadOnlyList<RuntimeAgentDefinition> operation, bool hasDeclaredEdges, string? conversationSlug)
    {
        if (!hasDeclaredEdges) return FrozenGraphTiers.FreeForm;
        var conversation = conversationSlug is { } slug
            ? operation.FirstOrDefault(agent => string.Equals(agent.Id, slug, StringComparison.OrdinalIgnoreCase))
            : null;
        var capabilities = conversation?.Capabilities ?? [];
        return capabilities.Any(capability =>
            string.Equals(capability, ThreeNamespaceMap.SpawnTemporaryCapability, StringComparison.OrdinalIgnoreCase)
            || string.Equals(capability, ThreeNamespaceMap.SpawnAliasCapability, StringComparison.OrdinalIgnoreCase))
            ? FrozenGraphTiers.SelfDispatch
            : FrozenGraphTiers.Deterministic;
    }

    private async Task<IReadOnlyList<RuntimeAgentDefinition>> FreezeModelPlansAsync(
        IReadOnlyList<RuntimeAgentDefinition> definitions,
        Guid sessionId,
        Guid modeVersionId,
        string? conversationTemplateSlug,
        SessionModelOverride? meetingModelOverride,
        CancellationToken cancellationToken)
    {
        var result = new List<RuntimeAgentDefinition>(definitions.Count);
        foreach (var definition in definitions)
        {
            var definitionId = definition.AgentDefinitionId ?? throw new InvalidDataException($"Agent '{definition.Id}' has no definition id.");
            var versionId = definition.AgentVersionId ?? throw new InvalidDataException($"Agent '{definition.Id}' has no version id.");
            var plan = await _models.FreezeAsync(new AgentModelFreezeRequest(
                sessionId, modeVersionId, definitionId, versionId, definition.Id,
                definition.ModelStrategyJson, definition.ModelStrategySource,
                IsConversationRoot(definition, conversationTemplateSlug),
                meetingModelOverride), cancellationToken).ConfigureAwait(false);
            result.Add(definition with { ModelPlan = plan });
        }
        return result;
    }

    // The conversation root is the frozen conversation identity holder; sessions
    // created before identity existed fall back to the literal meeting slug.
    private static bool IsConversationRoot(RuntimeAgentDefinition definition, string? conversationTemplateSlug) =>
        definition.Layer == "operation"
        && (conversationTemplateSlug is { } slug
            ? string.Equals(definition.Id, slug, StringComparison.OrdinalIgnoreCase)
            : string.Equals(definition.Id, "meeting", StringComparison.OrdinalIgnoreCase));

    private async Task<RuntimeProfileOverrideRecord?> LoadLatestOverrideAsync(
        SessionReference session,
        string profileId,
        CancellationToken cancellationToken)
    {
        await using var db = await _agents.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        var rows = await db.ProfileOverrides.AsNoTracking()
            .Where(item => item.TenantId == session.TenantId
                && item.WorkspaceId == session.WorkspaceId
                && item.ProfileId == profileId
                && item.Enabled)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return rows.OrderByDescending(item => item.Version).ThenByDescending(item => item.CreatedAt).FirstOrDefault();
    }

    private async Task<EffectivePolicy> ApplyOverrideAsync(
        AgentRuntimeConfigurationSnapshot snapshot,
        RuntimeProfileDefinition profile,
        RuntimeProfileOverrideRecord row,
        CancellationToken cancellationToken)
    {
        await using var stream = await _content.OpenReadAsync(
            new ContentReference(row.ContentReference, row.ContentHash, row.ContentLength, "application/json"), cancellationToken).ConfigureAwait(false);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken).ConfigureAwait(false);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidDataException("Runtime profile override must be a JSON object.");
        }

        var root = document.RootElement;
        var profileOverride = ReadProfile(root, profile);
        return new EffectivePolicy(
            ReadSpawn(root, snapshot.Spawn),
            ReadScheduling(root, snapshot.Scheduling),
            ReadSupervision(root, snapshot.Supervision),
            ReadContext(root, snapshot.Context),
            ReadMemory(root, snapshot.Memory),
            ReadTools(root, snapshot.Tools),
            profileOverride);
    }

    private static RuntimeAgentDefinition ToRuntimeAgentDefinition(RuntimeAgentRosterEntry e) => new(
        e.Id,
        e.Layer,
        e.Role,
        e.Lifecycle,
        e.Capabilities,
        e.DirectUserOutput,
        e.ContextAccess)
    {
        AgentDefinitionId = e.AgentDefinitionId,
        AgentVersionId = e.AgentVersionId,
        VersionContentHash = e.VersionContentHash,
        AllowedTools = e.AllowedTools,
        ResourceGrants = e.ResourceGrants,
        PromptProfile = e.PromptProfile,
        SystemPrompt = e.SystemPrompt,
        ModelStrategyJson = e.ModelStrategyJson,
        ModelStrategySource = e.ModelStrategySource,
        Enabled = e.Enabled,
        RosterOrder = e.RosterOrder,
        PromptPipelineId = e.PromptPipelineId,
        PromptVersionId = e.PromptVersionId,
        PromptVersionContentHash = e.PromptVersionContentHash,
        PromptGraphJson = e.PromptGraphJson
    };

    private static SpawnPolicy ReadSpawn(JsonElement root, SpawnPolicy fallback) => new(
        Positive(root, "spawn", "max_depth", fallback.MaxDepth, 0, 16),
        Positive(root, "spawn", "max_agents_per_run", fallback.MaxAgentsPerRun, 1, 128),
        Positive(root, "spawn", "max_parallel_workers", fallback.MaxParallelWorkers, 1, 32));

    private static SchedulingPolicy ReadScheduling(JsonElement root, SchedulingPolicy fallback) => new(
        Positive(root, "scheduling", "max_active_runs_per_session", fallback.MaxActiveRunsPerSession, 1, 32),
        Positive(root, "scheduling", "worker_retry_limit", fallback.WorkerRetryLimit, 0, 10),
        Boolean(root, "scheduling", "preserve_partial_results", fallback.PreservePartialResults));

    private static SupervisionPolicy ReadSupervision(JsonElement root, SupervisionPolicy fallback) => new(
        Boolean(root, "supervision", "required_before_final", fallback.RequiredBeforeFinal),
        Positive(root, "supervision", "max_revision_rounds", fallback.MaxRevisionRounds, 0, 10));

    private static ContextPolicy ReadContext(JsonElement root, ContextPolicy fallback) => new(
        Positive(root, "context", "default_token_budget", fallback.DefaultTokenBudget, 512, 262144),
        Positive(root, "context", "recent_message_limit", fallback.RecentMessageLimit, 1, 256),
        Boolean(root, "context", "optimistic_revision", fallback.OptimisticRevision));

    private static MemoryPolicy ReadMemory(JsonElement root, MemoryPolicy fallback) => new(
        Boolean(root, "memory", "candidate_only", fallback.CandidateOnly),
        Positive(root, "memory", "retrieval_limit", fallback.RetrievalLimit, 0, 64),
        Strings(root, "memory", "allowed_scopes", fallback.AllowedScopes),
        Strings(root, "memory", "allowed_kinds", fallback.AllowedKinds));

    private static ToolRuntimePolicy ReadTools(JsonElement root, ToolRuntimePolicy fallback)
    {
        var policy = new ToolRuntimePolicy(
            Text(root, "tools", "provider", fallback.Provider),
            Boolean(root, "tools", "mutation_requires_approval", fallback.MutationRequiresApproval),
            Boolean(root, "tools", "serialize_workspace_writes", fallback.SerializeWorkspaceWrites),
            Positive(root, "tools", "default_timeout_seconds", fallback.DefaultTimeoutSeconds, 1, 1800),
            // Core tool rounds count durable model/tool/result cycles. MAF's
            // auto-approval iteration limit has different N+1 inner-call semantics.
            Positive(root, "tools", "max_tool_rounds", fallback.MaxToolRounds, 0, ToolRuntimePolicy.MaximumRounds),
            MergeTaskRoundOverrides(root, fallback.Overrides));
        ToolRuntimePolicy.Validate(policy);
        return policy;
    }

    private static IReadOnlyDictionary<string, int>? MergeTaskRoundOverrides(JsonElement root, IReadOnlyDictionary<string, int> fallback)
    {
        if (!root.TryGetProperty("tools", out var tools) || tools.ValueKind != JsonValueKind.Object
            || !tools.TryGetProperty("task_round_overrides", out var node) || node.ValueKind != JsonValueKind.Object)
        {
            return fallback.Count == 0 ? null : fallback;
        }
        var merged = new Dictionary<string, int>(fallback, StringComparer.OrdinalIgnoreCase);
        foreach (var property in node.EnumerateObject())
        {
            if (property.Value.ValueKind == JsonValueKind.Number && property.Value.TryGetInt32(out var rounds))
            {
                merged[property.Name] = rounds;
            }
        }
        return merged;
    }

    private static RuntimeProfileDefinition ReadProfile(JsonElement root, RuntimeProfileDefinition fallback)
    {
        if (!root.TryGetProperty("profile", out var node) || node.ValueKind != JsonValueKind.Object) return fallback;
        return new RuntimeProfileDefinition(
            fallback.Id,
            Text(node, null, "activation_policy", fallback.ActivationPolicy),
            Strings(node, null, "operation_agents", fallback.OperationAgents),
            Strings(node, null, "execution_agents", fallback.ExecutionAgents),
            Boolean(node, null, "direct_answer_allowed", fallback.DirectAnswerAllowed));
    }

    private static int Positive(JsonElement root, string? section, string property, int fallback, int minimum, int maximum)
    {
        var node = Section(root, section);
        return node.ValueKind == JsonValueKind.Object && node.TryGetProperty(property, out var value) && value.TryGetInt32(out var parsed)
            ? Math.Clamp(parsed, minimum, maximum)
            : fallback;
    }

    private static bool Boolean(JsonElement root, string? section, string property, bool fallback)
    {
        var node = Section(root, section);
        return node.ValueKind == JsonValueKind.Object && node.TryGetProperty(property, out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False
            ? value.GetBoolean()
            : fallback;
    }

    private static string Text(JsonElement root, string? section, string property, string fallback)
    {
        var node = Section(root, section);
        return node.ValueKind == JsonValueKind.Object && node.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString())
            ? value.GetString()!.Trim()
            : fallback;
    }

    private static IReadOnlyList<string> Strings(JsonElement root, string? section, string property, IReadOnlyList<string> fallback)
    {
        var node = Section(root, section);
        if (node.ValueKind != JsonValueKind.Object || !node.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Array) return fallback;
        var values = value.EnumerateArray().Where(item => item.ValueKind == JsonValueKind.String)
            .Select(item => item.GetString()!.Trim()).Where(item => item.Length != 0).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        return values.Length == 0 ? fallback : values;
    }

    private static JsonElement Section(JsonElement root, string? section) => section is null ? root : root.TryGetProperty(section, out var value) ? value : default;

    // Unattended permission modes pass through admission verbatim instead of
    // being folded away: a frozen body must record the mode the run was
    // actually admitted under. Executability stays fail-closed in
    // ToolInvocationScopeResolver, and every executable grant is still minted
    // through the approval coordinator's binding-checked path.
    internal static string NormalizePermissionMode(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "deny" => "deny",
        "auto-approve" => "auto-approve",
        "full-access" => "full-access",
        "default" or "ask" or null or "" => "ask",
        _ => "ask"
    };

    private static Guid DeterministicGuid(string value)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return new Guid(bytes.AsSpan(0, 16));
    }

    private sealed record EffectivePolicy(
        SpawnPolicy Spawn,
        SchedulingPolicy Scheduling,
        SupervisionPolicy Supervision,
        ContextPolicy Context,
        MemoryPolicy Memory,
        ToolRuntimePolicy Tools,
        RuntimeProfileDefinition Profile);
}
