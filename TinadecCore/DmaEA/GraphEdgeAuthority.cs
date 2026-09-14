namespace TinadecCore.DmaEA;

/// <summary>
/// Pure dispatch authority for declared-graph tiers:
/// deterministic — a task may only be assigned to a worker whose AGENT SLUG is
///   the slug of a node that is the target of a declared edge sourced from the
///   conversation node or any other operation-layer node;
/// self_dispatch — declared edge targets plus spawned workers whose slug is a
///   member of the frozen spawnable-template whitelist;
/// free_form — no declared constraints: the single director may assign any
///   worker it spawned (edges are prompt material only).
/// Edges are declared over NODE KEYS while dispatch selects agent slugs, so the
/// authority translates target node keys through the frozen node set.
/// Deliberately a static pure function so the negative cases are unit-tested
/// directly and the dispatch site stays a single call.
/// </summary>
public static class GraphEdgeAuthority
{
    public static bool IsDispatchAllowed(FrozenGraph? graph, string? workerSlug)
    {
        if (graph is null) return true;
        if (string.IsNullOrWhiteSpace(workerSlug)) return false;
        if (string.Equals(graph.Tier, FrozenGraphTiers.FreeForm, StringComparison.Ordinal)) return true;
        var nodeBySlug = graph.Nodes.ToDictionary(node => node.AgentSlug, StringComparer.Ordinal);
        if (!nodeBySlug.TryGetValue(workerSlug, out var workerNode))
        {
            return string.Equals(graph.Tier, FrozenGraphTiers.SelfDispatch, StringComparison.Ordinal)
                && graph.SpawnableTemplates.Any(template =>
                    string.Equals(template.Slug, workerSlug, StringComparison.OrdinalIgnoreCase));
        }
        var workerNodeKey = workerNode.NodeKey;

        foreach (var edge in graph.Edges)
        {
            if (!string.Equals(edge.TargetNodeKey, workerNodeKey, StringComparison.Ordinal))
            {
                continue;
            }
            var sourceIsConversation = string.Equals(edge.SourceNodeKey, graph.ConversationNodeKey, StringComparison.Ordinal);
            if (sourceIsConversation)
            {
                return true;
            }
            var sourceNode = graph.Nodes.FirstOrDefault(node =>
                string.Equals(node.NodeKey, edge.SourceNodeKey, StringComparison.Ordinal));
            if (sourceNode is not null && string.Equals(sourceNode.Layer, "operation", StringComparison.Ordinal))
            {
                return true;
            }
        }
        return false;
    }
}
