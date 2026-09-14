using System.Text.Json;
using TinadecCore.Abstractions.Ports;
using TinadecCore.DmaEA;
using TinadecCore.Runtime;

namespace TinadecCore.AgentFramework.Tests;

/// <summary>
/// Phase 2 pinning: schema v2 freezes a Graph section for EVERY mode (free_form
/// is a tier on disk, not the absence of one), the tier derivation is the
/// three-branch decision (no edges → free_form; edges + spawn authority →
/// self_dispatch; edges without spawn authority → deterministic), the dispatch
/// and spawn authorities are tier-aware pure functions, and the freeze gate
/// accepts the free-form single-director shape while still rejecting lanes×graph.
/// </summary>
public sealed class GraphOrchestrationPhase2Tests
{
    private static RuntimeAgentDefinition Agent(string id, string layer, string[]? capabilities = null, string[]? tools = null) =>
        new(id, layer, "task_executor", "on_demand", capabilities ?? [], DirectUserOutput: false, ContextAccess: "read")
        { AllowedTools = tools ?? [] };

    private static FrozenGraphNode Node(string key, string slug, string layer, bool isConversation = false) =>
        new(key, slug, layer, isConversation);

    private static FrozenSpawnableTemplate Template(string slug, string[]? tools = null, string[]? capabilities = null) =>
        new(slug, Guid.NewGuid(), Guid.NewGuid(), "hash-" + slug, "task_executor",
            tools ?? ["read_file"], capabilities ?? ["task.dispatch"]);

    private static FrozenRunConfigurationV1 MinimalConfiguration(FrozenGraph? graph) => new(
        FrozenRunConfigurationV1.CurrentSchemaVersion, "baseline-hash", 1,
        "conversation", "vibe", "profile-id", "ask",
        new SpawnPolicy(2, 16, 4),
        new SchedulingPolicy(2, 2, true),
        new SupervisionPolicy(true, 2),
        new ContextPolicy(8192, 24, true),
        new MemoryPolicy(true, 8, ["workspace"], ["fact"]),
        new ToolRuntimePolicy("tinadec-tools-process", true, true, 120, 4),
        [Agent("meeting", "operation", ["user.respond", "agent.create_temporary"])],
        [Agent("search", "execution", tools: ["mcp_search", "read_file"])],
        null,
        [],
        "")
    { Graph = graph };

    // ── schema v2: every mode freezes a Graph section ──────────────────────────

    [Fact]
    public void SchemaVersion_Is_V2Literal()
    {
        Assert.Equal("frozen-run-configuration/v2", FrozenRunConfigurationV1.CurrentSchemaVersion);
    }

    [Fact]
    public void V2Body_WritesGraphSection_AndRoundTripsTierNodesEdges()
    {
        var graph = new FrozenGraph(
            FrozenGraphTiers.SelfDispatch, "meeting", "meeting-1",
            [Node("meeting-1", "meeting", "operation", isConversation: true), Node("search-1", "search", "execution")],
            [new DeclaredGraphEdge("e1", "meeting-1", "search-1")]);
        var body = JsonSerializer.Serialize(MinimalConfiguration(graph), FrozenRunConfigurationV1.JsonOptions);
        Assert.Contains("\"graph\":", body, StringComparison.Ordinal);
        Assert.Contains("\"tier\":\"self_dispatch\"", body, StringComparison.Ordinal);
        Assert.Contains("\"schemaVersion\":\"frozen-run-configuration/v2\"", body, StringComparison.Ordinal);

        var roundTripped = JsonSerializer.Deserialize<FrozenRunConfigurationV1>(body, FrozenRunConfigurationV1.JsonOptions);
        Assert.NotNull(roundTripped?.Graph);
        Assert.Equal(FrozenGraphTiers.SelfDispatch, roundTripped.Graph.Tier);
        Assert.Equal("meeting", roundTripped.Graph.ConversationTemplateSlug);
        Assert.Equal(2, roundTripped.Graph.Nodes.Count);
        Assert.Single(roundTripped.Graph.Edges);
        Assert.Equal(FrozenRunConfigurationV1.CurrentSchemaVersion, roundTripped.SchemaVersion);
    }

    [Fact]
    public void FreeFormGraphSection_CarriesTierOnDisk()
    {
        // The free_form shape is a Graph section with no dispatch edges — the
        // phase 1.5 "edge-less modes write no Graph key" guarantee is retired.
        var graph = new FrozenGraph(
            FrozenGraphTiers.FreeForm, "meeting", "meeting-1",
            [Node("meeting-1", "meeting", "operation", isConversation: true)],
            []);
        var body = JsonSerializer.Serialize(MinimalConfiguration(graph), FrozenRunConfigurationV1.JsonOptions);
        Assert.Contains("\"tier\":\"free_form\"", body, StringComparison.Ordinal);

        var roundTripped = JsonSerializer.Deserialize<FrozenRunConfigurationV1>(body, FrozenRunConfigurationV1.JsonOptions);
        Assert.NotNull(roundTripped?.Graph);
        Assert.Empty(roundTripped.Graph.Edges);
    }

    [Fact]
    public void EdgeDataContract_FreezesVerbatim_AndOmitsWhenAbsent()
    {
        var withContract = new DeclaredGraphEdge("e1", "meeting-1", "search-1")
        {
            DataContract = JsonSerializer.SerializeToElement(new { request = new[] { "query" } })
        };
        var withoutContract = new DeclaredGraphEdge("e2", "search-1", "meeting-1");
        var graph = new FrozenGraph(
            FrozenGraphTiers.SelfDispatch, "meeting", "meeting-1",
            [Node("meeting-1", "meeting", "operation", isConversation: true), Node("search-1", "search", "execution")],
            [withContract, withoutContract]);
        var body = JsonSerializer.Serialize(MinimalConfiguration(graph), FrozenRunConfigurationV1.JsonOptions);

        Assert.Contains("\"dataContract\":", body, StringComparison.Ordinal);
        var roundTripped = JsonSerializer.Deserialize<FrozenRunConfigurationV1>(body, FrozenRunConfigurationV1.JsonOptions);
        Assert.NotNull(roundTripped?.Graph);
        Assert.NotNull(roundTripped.Graph.Edges[0].DataContract);
        Assert.Null(roundTripped.Graph.Edges[1].DataContract);
        // (An empty condition object is normalized to null at PARSE time —
        // ParseDeclaredEdges freezes only non-empty contracts.)
    }

    // ── three-branch tier derivation ───────────────────────────────────────────

    [Fact]
    public void TierDerivation_NoEdges_IsFreeForm_RegardlessOfNodeCount()
    {
        var operation = new[] { Agent("meeting", "operation", ["user.respond", "agent.create_temporary"]) };
        var execution = new[] { Agent("search", "execution") };
        Assert.Equal(FrozenGraphTiers.FreeForm,
            AgentRuntimeConfigurationResolver.DeriveGraphTier(operation, hasDeclaredEdges: false, "meeting"));

        // Edge-less + spawn authority is still free_form even with a full roster.
        Assert.Equal(FrozenGraphTiers.FreeForm,
            AgentRuntimeConfigurationResolver.DeriveGraphTier(operation.Concat(execution).ToArray(), hasDeclaredEdges: false, "meeting"));
    }

    [Fact]
    public void TierDerivation_WithEdges_SpawnAuthorityDecides()
    {
        var temporary = new[] { Agent("meeting", "operation", ["user.respond", "agent.create_temporary"]) };
        var alias = new[] { Agent("meeting", "operation", ["user.respond", "agent.spawn"]) };
        var persistentOnly = new[] { Agent("meeting", "operation", ["user.respond", "agent.create_persistent"]) };
        var none = new[] { Agent("meeting", "operation", ["user.respond"]) };

        Assert.Equal(FrozenGraphTiers.SelfDispatch,
            AgentRuntimeConfigurationResolver.DeriveGraphTier(temporary, hasDeclaredEdges: true, "meeting"));
        Assert.Equal(FrozenGraphTiers.SelfDispatch,
            AgentRuntimeConfigurationResolver.DeriveGraphTier(alias, hasDeclaredEdges: true, "meeting"));
        Assert.Equal(FrozenGraphTiers.Deterministic,
            AgentRuntimeConfigurationResolver.DeriveGraphTier(persistentOnly, hasDeclaredEdges: true, "meeting"));
        Assert.Equal(FrozenGraphTiers.Deterministic,
            AgentRuntimeConfigurationResolver.DeriveGraphTier(none, hasDeclaredEdges: true, "meeting"));
    }

    // ── tier-aware dispatch authority ──────────────────────────────────────────

    private static FrozenGraph VibeGraph(string tier = FrozenGraphTiers.SelfDispatch, FrozenSpawnableTemplate[]? spawnable = null) => new(
        tier, "meeting", "meeting-1",
        [Node("meeting-1", "meeting", "operation", isConversation: true), Node("search-1", "search", "execution"), Node("eng-1", "global_engineering", "execution")],
        [new DeclaredGraphEdge("e1", "meeting-1", "search-1"), new DeclaredGraphEdge("e2", "meeting-1", "eng-1")])
    { SpawnableTemplates = spawnable ?? [] };

    [Fact]
    public void DispatchAuthority_DeterministicEdgeTargetsOnly()
    {
        var graph = VibeGraph(FrozenGraphTiers.Deterministic,
            [Template("evolved_worker")]); // deterministic whitelist is inert for dispatch
        Assert.True(GraphEdgeAuthority.IsDispatchAllowed(graph, "search"));
        Assert.True(GraphEdgeAuthority.IsDispatchAllowed(graph, "global_engineering"));
        // Spawned-template slug is NOT a dispatch target in the deterministic tier.
        Assert.False(GraphEdgeAuthority.IsDispatchAllowed(graph, "evolved_worker"));
        Assert.False(GraphEdgeAuthority.IsDispatchAllowed(graph, "worker.git"));
        Assert.False(GraphEdgeAuthority.IsDispatchAllowed(graph, ""));
    }

    [Fact]
    public void DispatchAuthority_SelfDispatch_AllowsWhitelistMembersBeyondTheRoster()
    {
        var graph = VibeGraph(FrozenGraphTiers.SelfDispatch, [Template("evolved_worker")]);
        Assert.True(GraphEdgeAuthority.IsDispatchAllowed(graph, "search"));
        Assert.True(GraphEdgeAuthority.IsDispatchAllowed(graph, "evolved_worker"));
        Assert.False(GraphEdgeAuthority.IsDispatchAllowed(graph, "outside_whitelist"));
    }

    [Fact]
    public void DispatchAuthority_FreeForm_AllowsAnyWorker()
    {
        var graph = VibeGraph(FrozenGraphTiers.FreeForm);
        Assert.True(GraphEdgeAuthority.IsDispatchAllowed(graph, "search"));
        Assert.True(GraphEdgeAuthority.IsDispatchAllowed(graph, "anything_at_all"));
        Assert.True(GraphEdgeAuthority.IsDispatchAllowed(null, "anything"));
    }

    // ── spawn authority ────────────────────────────────────────────────────────

    [Fact]
    public void SpawnAuthority_DeterministicAlwaysDenied()
    {
        var graph = VibeGraph(FrozenGraphTiers.Deterministic, [Template("search")]);
        Assert.False(GraphSpawnAuthority.IsSpawnAllowed(graph, "search"));
        Assert.False(GraphSpawnAuthority.IsSpawnAllowed(null, "search"));
    }

    [Fact]
    public void SpawnAuthority_WhitelistMembershipDecides()
    {
        var graph = VibeGraph(FrozenGraphTiers.SelfDispatch, [Template("search"), Template("evolved_worker")]);
        Assert.True(GraphSpawnAuthority.IsSpawnAllowed(graph, "search"));
        Assert.True(GraphSpawnAuthority.IsSpawnAllowed(graph, "EVOLVED_WORKER")); // case-insensitive
        Assert.False(GraphSpawnAuthority.IsSpawnAllowed(graph, "outside_whitelist"));
        Assert.False(GraphSpawnAuthority.IsSpawnAllowed(graph, ""));

        // Empty whitelist (no relationship agent_types) denies everything.
        Assert.False(GraphSpawnAuthority.IsSpawnAllowed(VibeGraph(FrozenGraphTiers.SelfDispatch), "search"));
    }

    [Fact]
    public void SpawnSelection_CoversRequirements_AndPrefersClosestFit()
    {
        var broad = Template("broad", tools: ["read_file", "write_file", "shell", "mcp_search"]);
        var narrow = Template("narrow", tools: ["read_file"]);
        var wild = Template("wild", tools: ["*"]);
        var graph = VibeGraph(FrozenGraphTiers.FreeForm, [broad, narrow, wild]);

        Assert.Equal("narrow", GraphSpawnAuthority.SelectSpawnable(graph, ["read_file"], [])!.Slug);
        Assert.Equal("broad", GraphSpawnAuthority.SelectSpawnable(graph, ["read_file", "shell"], [])!.Slug);
        // A wildcard ceiling covers any requirement.
        Assert.Equal("wild", GraphSpawnAuthority.SelectSpawnable(graph, ["mcp_invoke"], [])!.Slug);
        // Capability requirements must be covered too (closest fit still wins).
        Assert.Equal("narrow", GraphSpawnAuthority.SelectSpawnable(graph, ["read_file"], ["task.dispatch"])!.Slug);
        // No coverage → no selection (no wildcard ceiling anywhere).
        var noWildcard = VibeGraph(FrozenGraphTiers.FreeForm, [narrow, broad]);
        Assert.Null(GraphSpawnAuthority.SelectSpawnable(noWildcard, ["git_push"], []));
        Assert.Null(GraphSpawnAuthority.SelectSpawnable(VibeGraph(FrozenGraphTiers.Deterministic, [broad]), ["read_file"], []));
        Assert.Null(GraphSpawnAuthority.SelectSpawnable(null, ["read_file"], []));
    }

    // ── freeze gate: free-form single-director shape + lanes rule ──────────────

    [Fact]
    public void FreezeGate_FreeFormDirectorWithoutExecutionRoster_IsAccepted()
    {
        var director = Agent("meeting", "operation", ["user.respond", "agent.create_temporary", "agent.spawn"]);
        var graph = new FrozenGraph(FrozenGraphTiers.FreeForm, "meeting", "meeting-1",
            [Node("meeting-1", "meeting", "operation", isConversation: true)], []);
        var identity = new RunFreezeGate.ConversationIdentity("meeting-1", "meeting");

        // Empty execution roster is legal only for the free_form director with
        // spawn authority.
        RunFreezeGate.Validate(identity, [director], [], graph, lanesEnabled: false);
    }

    [Fact]
    public void FreezeGate_EmptyExecutionRoster_OtherwiseRejected()
    {
        var coordinator = Agent("meeting", "operation", ["user.respond"]); // no spawn authority
        var graph = new FrozenGraph(FrozenGraphTiers.FreeForm, "meeting", "meeting-1",
            [Node("meeting-1", "meeting", "operation", isConversation: true)], []);
        var identity = new RunFreezeGate.ConversationIdentity("meeting-1", "meeting");

        var exception = Assert.Throws<RunAdmissionException>(() =>
            RunFreezeGate.Validate(identity, [coordinator], [], graph, lanesEnabled: false));
        Assert.Equal("mode_topology_invalid", exception.Code);

        // Deterministic tier with an empty execution roster is also rejected even
        // when the holder carries spawn caps (edges exist → not free-form).
        var spawnCapable = Agent("meeting", "operation", ["user.respond", "agent.create_temporary"]);
        var edgeGraph = new FrozenGraph(FrozenGraphTiers.Deterministic, "meeting", "meeting-1",
            [Node("meeting-1", "meeting", "operation", isConversation: true)],
            [new DeclaredGraphEdge("e1", "meeting-1", "search-1")]);
        Assert.Throws<RunAdmissionException>(() =>
            RunFreezeGate.Validate(identity, [spawnCapable], [], edgeGraph, lanesEnabled: false));

        // Legacy null-graph recovery tolerance still rejects an empty roster.
        Assert.Throws<RunAdmissionException>(() =>
            RunFreezeGate.Validate(null, [coordinator], [], null, lanesEnabled: false));
    }

    [Fact]
    public void FreezeGate_GraphTierWithLanesEnabled_Rejected_AtAdmission()
    {
        var operation = new[] { Agent("meeting", "operation", ["user.respond"]) };
        var execution = new[] { Agent("search", "execution") };
        var identity = new RunFreezeGate.ConversationIdentity("meeting-1", "meeting");

        var exception = Assert.Throws<RunAdmissionException>(() =>
            RunFreezeGate.Validate(identity, operation, execution, VibeGraph(), lanesEnabled: true));
        Assert.Equal("graph_tier_lanes_unsupported", exception.Code);
    }
}
