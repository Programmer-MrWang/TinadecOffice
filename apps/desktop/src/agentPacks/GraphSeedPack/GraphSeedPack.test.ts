import { describe, expect, it } from 'vitest'
import { digestAgentPackManifest } from '../packIntegrity'
import {
  GRAPH_SEED_PACK_DIGEST,
  GRAPH_SEED_PACK_ID,
  GRAPH_SEED_PACK_VERSION,
  graphSeedPackEnvelope,
  graphSeedPackManifest,
} from './index'

describe('GraphSeedPack', () => {
  it('has stable app ownership and internal references', () => {
    expect(graphSeedPackManifest.metadata.pack_id).toBe(GRAPH_SEED_PACK_ID)
    expect(graphSeedPackManifest.metadata.owner).toBe('tinadec')
    expect(graphSeedPackManifest.metadata.product_id).toBe('tinadec-core')
    expect(graphSeedPackManifest.metadata.version).toBe(GRAPH_SEED_PACK_VERSION)

    // Three execution templates plus the conversation identity: exactly the roster
    // the three tier modes draw from (no governance/auxiliary agents — a seed pack
    // must not depend on Core-internal roles).
    const agents = graphSeedPackManifest.resources.agents
    expect(agents.map((agent) => agent.resource_key)).toEqual(['meeting', 'search', 'global_engineering'])
    expect(agents.every((agent) => Boolean(agent.system_prompt?.trim()))).toBe(true)

    // Core denies every tool invocation for an operation-layer instance, so a
    // conversation node that declared tools would ship a pack whose data
    // contradicts its enforced behavior.
    for (const agent of agents.filter((row) => row.layer === 'operation')) {
      expect(agent.tool_scope, `agent '${agent.resource_key}' must declare no tools`).toEqual([])
    }
    // The engineering template carries the git tools this round added: a pack whose
    // prose promises repository work must declare them or the ceiling silently
    // omits them.
    const engineering = agents.find((agent) => agent.resource_key === 'global_engineering')!
    expect(engineering.tool_scope).toContain('git_commit')
    expect(engineering.tool_scope).toContain('git_push')
  })

  it('declares one mode per orchestration tier', () => {
    const modes = graphSeedPackManifest.resources.modes
    expect(modes.map((mode) => mode.resource_key)).toEqual(['free_director', 'vibe_graph', 'fixed_pipeline'])

    const bySlug = new Map(modes.map((mode) => [mode.resource_key, mode] as const))
    // free_form: a single director node and no declared edges — the tier is
    // derived from the topology, so an authoring mistake here silently changes
    // which enforcement path a run takes.
    expect(bySlug.get('free_director')!.nodes).toHaveLength(1)
    expect(bySlug.get('free_director')!.edges).toHaveLength(0)
    // self_dispatch and deterministic share the same three nodes and two edges;
    // they differ in the meeting binding's envelope (deterministic removes the
    // spawn room).
    for (const key of ['vibe_graph', 'fixed_pipeline'] as const) {
      expect(bySlug.get(key)!.nodes).toHaveLength(3)
      expect(bySlug.get(key)!.edges).toHaveLength(2)
    }

    const resourceKeys = new Set(graphSeedPackManifest.resources.agents.map((agent) => agent.resource_key))
    for (const mode of modes) {
      expect(mode.nodes.some((node) => node.layer === 'operation')).toBe(true)
      for (const node of mode.nodes) {
        expect(node.agent_ref).toMatch(/^agent:/)
        expect(resourceKeys.has(node.agent_ref.slice('agent:'.length))).toBe(true)
      }
      // Edge endpoints must resolve to declared nodes, or the frozen graph would
      // carry an edge the dispatch path can never walk.
      const nodeKeys = new Set(mode.nodes.map((node) => node.node_key))
      for (const edge of mode.edges) {
        expect(nodeKeys.has(edge.source_node_key), `${mode.resource_key} edge source`).toBe(true)
        expect(nodeKeys.has(edge.target_node_key), `${mode.resource_key} edge target`).toBe(true)
      }
    }
  })

  it('carries all five relationship fields on every node', () => {
    // The relationship file is compiled into the role system prompt through a
    // fixed tail slot that participates in the prompt hash; a missing field means
    // a silently weaker contract rather than a failure.
    for (const mode of graphSeedPackManifest.resources.modes) {
      for (const node of mode.nodes) {
        const relationship = node.relationship
        expect(relationship, `${mode.resource_key}/${node.node_key} relationship`).toBeTruthy()
        expect(relationship!.duty.trim().length).toBeGreaterThan(0)
        expect(Object.keys(relationship!.inputs_outputs).length).toBeGreaterThan(0)
        expect(Array.isArray(relationship!.allowed_dispatch_targets)).toBe(true)
        expect(relationship!.success_criteria.length).toBeGreaterThan(0)
        expect(Array.isArray(relationship!.agent_types)).toBe(true)
      }
    }

    // The spawn whitelist is what makes a spawn demand admissible in free_form;
    // only the free director declares one (the deterministic tier has none, which
    // is why graph_tier_spawn_denied is its contract).
    const freeDirector = graphSeedPackManifest.resources.modes.find((mode) => mode.resource_key === 'free_director')!
    expect(freeDirector.nodes[0].relationship!.agent_types).toEqual(['search', 'global_engineering'])
    const fixedPipeline = graphSeedPackManifest.resources.modes.find((mode) => mode.resource_key === 'fixed_pipeline')!
    expect(fixedPipeline.nodes[0].relationship!.agent_types).toEqual(['search', 'global_engineering'])
    // The graph tier derives the deterministic contract from the topology, but the
    // spawn room is what the gate reads: an absent spawn envelope is a denial.
    const fixedBinding = fixedPipeline.bindings!.find((binding) => binding.node_key === 'meeting')!
    expect(fixedBinding.envelope!.spawn!.max_depth).toBe(0)
  })

  it('binds node-less envelopes for spawnable templates and narrows tools where declared', () => {
    const freeDirector = graphSeedPackManifest.resources.modes.find((mode) => mode.resource_key === 'free_director')!
    // Node-less bindings attach a resource envelope to a spawnable template: the
    // director spawns these through the engine-authoritative path, and the
    // envelope is where the spawned instance's resource grants come from.
    const nodeLess = freeDirector.bindings!.filter((binding) => binding.node_key == null)
    expect(nodeLess.map((binding) => binding.agent_ref).sort()).toEqual(['agent:global_engineering', 'agent:search'])
    for (const binding of nodeLess) {
      expect(binding.envelope!.resources!.read).toEqual([''])
    }
    expect(nodeLess.find((binding) => binding.agent_ref === 'agent:global_engineering')!.envelope!.resources!.write).toEqual([''])
    expect(nodeLess.find((binding) => binding.agent_ref === 'agent:search')!.envelope!.resources!.write).toBeUndefined()

    // A tool switch can only narrow the template scope; the deterministic tier
    // uses one so its engineering node never writes.
    const fixedPipeline = graphSeedPackManifest.resources.modes.find((mode) => mode.resource_key === 'fixed_pipeline')!
    const engineering = fixedPipeline.bindings!.find((binding) => binding.agent_ref === 'agent:global_engineering')!
    expect(engineering.tool_switches).toEqual({ write_file: false })
  })

  it('points activation at declared resources', () => {
    const defaults = graphSeedPackManifest.activation.workspace_defaults
    const agentKeys = new Set(graphSeedPackManifest.resources.agents.map((agent) => agent.resource_key))
    const promptKeys = new Set(graphSeedPackManifest.resources.prompt_pipelines.map((pipeline) => pipeline.resource_key))
    expect(agentKeys.has(defaults.agent_ref.slice('agent:'.length))).toBe(true)
    expect(graphSeedPackManifest.resources.modes.some((mode) => `mode:${mode.resource_key}` === defaults.mode_ref)).toBe(true)
    expect(promptKeys.has(defaults.prompt_pipeline_ref.slice('prompt:'.length))).toBe(true)
    for (const agent of graphSeedPackManifest.resources.agents) {
      expect(agent.base_prompt_pipeline_ref).toMatch(/^prompt:/)
      expect(promptKeys.has(agent.base_prompt_pipeline_ref!.slice('prompt:'.length))).toBe(true)
    }
  })

  it('carries the RFC 8785 SHA-256 digest of the manifest only', async () => {
    expect(await digestAgentPackManifest(graphSeedPackManifest)).toBe(GRAPH_SEED_PACK_DIGEST)
    expect(graphSeedPackEnvelope.integrity.digest).toBe(GRAPH_SEED_PACK_DIGEST)
  })
})
