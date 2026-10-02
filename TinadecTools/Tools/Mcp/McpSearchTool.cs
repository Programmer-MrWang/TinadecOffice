using NLog;
using TinadecTools.Abstractions;

namespace TinadecTools.Tools.Mcp;

public static class McpSearchTool
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    [ToolFunction("mcp_search", Description = "Search the tool catalog of the configured MCP servers (external integrations). An empty result always carries a reason plus config_path and per-server failures — read them instead of guessing a server or tool id. Built-in workspace tools (ls, file_search, read_file, git_status) work without any MCP server.")]
    public static async ValueTask<McpSearchResponse> HandleAsync(McpSearchParams args, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(args.Query))
            return new McpSearchResponse { Reason = "query is required and must not be blank." };

        var terms = args.Query.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (terms.Length == 0)
            return new McpSearchResponse { Reason = $"The query '{args.Query}' contains no searchable term." };

        var limit = Math.Clamp(args.Limit, 1, 100);
        var response = new McpSearchResponse { ConfigPath = McpRuntime.Repository.ConfigPath };
        var servers = await McpRuntime.Repository.ListAsync(cancellationToken).ConfigureAwait(false);
        response.ServersQueried = servers.Count;
        if (servers.Count == 0)
        {
            // No server configured: say so, and point at the built-in alternative.
            // An unexplained empty result is what made an agent report "the tool
            // returned nothing" and then guess a server id that never existed.
            response.Reason =
                $"No MCP server is configured in '{response.ConfigPath}', so mcp_search has no tool catalog to search. "
                + "Add a server there (or point TINADEC_TOOLS_MCP_CONFIG at one), or use the built-in workspace tools "
                + "(ls, file_search, read_file, git_status) instead.";
            return response;
        }

        foreach (var server in servers)
        {
            IReadOnlyList<McpToolSummary> tools;
            try
            {
                tools = await McpRuntime.ClientPool.ListToolsAsync(server, args.IncludeSchema, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                Logger.Warn(ex, "mcp_search failed for server {serverId}", server.Id);
                response.Failures.Add(new McpSearchFailure { ServerId = server.Id, Error = ex.Message });
                continue;
            }

            response.ToolsListed += tools.Count;
            foreach (var tool in tools)
            {
                var score = Score(tool, terms);
                if (score <= 0)
                    continue;

                response.Results.Add(new McpSearchResult
                {
                    ServerId = server.Id,
                    ServerName = string.IsNullOrWhiteSpace(server.Name) ? server.Id : server.Name,
                    Score = score,
                    Tool = tool
                });
            }
        }

        response.Results = response.Results
            .OrderByDescending(result => result.Score)
            .ThenBy(result => result.ServerId, StringComparer.OrdinalIgnoreCase)
            .ThenBy(result => result.Tool.Name, StringComparer.OrdinalIgnoreCase)
            .Take(limit)
            .ToList();

        if (response.Results.Count == 0)
        {
            response.Reason = response.Failures.Count == servers.Count
                ? $"Every configured MCP server failed to list its tools: {Describe(response.Failures)}."
                : $"No MCP tool matched '{args.Query}'; {servers.Count} configured server(s) listed {response.ToolsListed} tool(s)."
                    + (response.Failures.Count > 0 ? $" Unreachable servers: {Describe(response.Failures)}." : string.Empty);
        }

        return response;
    }

    private static string Describe(IReadOnlyList<McpSearchFailure> failures) =>
        string.Join("; ", failures.Select(failure => $"{failure.ServerId}: {failure.Error}"));

    private static int Score(McpToolSummary tool, IReadOnlyList<string> terms)
    {
        var score = 0;
        foreach (var term in terms)
        {
            score += ScoreField(tool.Name, term, 10);
            if (!string.IsNullOrWhiteSpace(tool.Description))
                score += ScoreField(tool.Description, term, 4);
        }

        return score;
    }

    private static int ScoreField(string value, string term, int weight)
    {
        if (value.Equals(term, StringComparison.OrdinalIgnoreCase))
            return weight * 4;

        if (value.StartsWith(term, StringComparison.OrdinalIgnoreCase))
            return weight * 2;

        return value.Contains(term, StringComparison.OrdinalIgnoreCase) ? weight : 0;
    }
}
