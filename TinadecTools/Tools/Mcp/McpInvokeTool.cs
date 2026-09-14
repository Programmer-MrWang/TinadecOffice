using NLog;
using TinadecTools.Abstractions;

namespace TinadecTools.Tools.Mcp;

public static class McpInvokeTool
{
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    // Approving an MCP call is a human control gate, not an implicit claim that
    // the call mutates THIS workspace (an MCP server is an external surface).
    // Declaring it explicitly keeps a read-only agent holding only workspace read
    // grants from being denied before the approval gate is even consulted.
    [ToolFunction("mcp_invoke", RequiresApproval = true, MutatesWorkspace = false, Description = "Invoke one tool on a configured MCP server (server_id and tool_name must come from mcp_search or mcp_list). Approval-gated; an unknown server fails with the config path that was searched.")]
    public static async ValueTask<McpInvokeResponse> HandleAsync(McpInvokeParams args, CancellationToken cancellationToken)
    {
        try
        {
            var server = await McpRuntime.Repository.GetRequiredAsync(args.ServerId, cancellationToken).ConfigureAwait(false);
            var result = await McpRuntime.ClientPool.InvokeAsync(server, args.ToolName, args.Arguments, cancellationToken).ConfigureAwait(false);

            return new McpInvokeResponse
            {
                Success = true,
                ServerId = server.Id,
                ToolName = args.ToolName,
                Result = result
            };
        }
        catch (Exception ex)
        {
            Logger.Warn(ex, "mcp_invoke failed for server {serverId} tool {toolName}", args.ServerId, args.ToolName);
            return new McpInvokeResponse
            {
                Success = false,
                Error = ex.Message,
                ServerId = args.ServerId,
                ToolName = args.ToolName
            };
        }
    }
}
