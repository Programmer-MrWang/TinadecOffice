using System.Text.Json;
using TinadecTools.Runtime;

namespace TinadecTools.Tools.Mcp;

internal sealed class McpServerRepository
{
    public const string ConfigPathEnvironmentVariable = "TINADEC_TOOLS_MCP_CONFIG";

    private readonly string _configPath;
    public string ConfigPath => ToolExecutionContext.Current is { } context
        ? $"execution-context:{context.SettingsHash}" : _configPath;

    public McpServerRepository(string? configPath = null)
    {
        _configPath = ResolveConfigPath(configPath);
    }

    public async Task<IReadOnlyList<McpServerConfig>> ListAsync(CancellationToken cancellationToken = default)
    {
        if (ToolExecutionContext.Current is { } context) return context.McpServers;
        if (!File.Exists(ConfigPath))
            return [];

        await using var stream = new FileStream(ConfigPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        var file = await JsonSerializer.DeserializeAsync(stream, McpJsonContext.Default.McpServersFile, cancellationToken)
            .ConfigureAwait(false);

        return file?.Servers.Where(IsValid).ToArray() ?? [];
    }

    public async Task<McpServerConfig> GetRequiredAsync(string serverId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(serverId);
        var servers = await ListAsync(cancellationToken).ConfigureAwait(false);
        var exactResources = servers.Where(server => !string.IsNullOrWhiteSpace(server.ResourceId)
            && string.Equals(server.ResourceId, serverId, StringComparison.OrdinalIgnoreCase)).ToArray();
        if (exactResources.Length == 1) return exactResources[0];
        var friendly = servers.Where(server => string.Equals(server.Id, serverId, StringComparison.OrdinalIgnoreCase)).ToArray();
        if (exactResources.Length > 1 || friendly.Length > 1)
            throw new InvalidOperationException($"MCP server id '{serverId}' is ambiguous; use the exact resource_id returned by mcp_list or mcp_search.");
        return friendly.SingleOrDefault()
            ?? throw new InvalidOperationException($"MCP server '{serverId}' was not found in {ConfigPath}.");
    }

    internal static string ServerHandle(McpServerConfig server, IReadOnlyList<McpServerConfig> servers) =>
        !string.IsNullOrWhiteSpace(server.ResourceId)
        && servers.Count(other => string.Equals(other.Id, server.Id, StringComparison.OrdinalIgnoreCase)) > 1
            ? server.ResourceId : server.Id;

    private static bool IsValid(McpServerConfig server)
    {
        return !string.IsNullOrWhiteSpace(server.Id) && !string.IsNullOrWhiteSpace(server.Command);
    }

    private static string ResolveConfigPath(string? configPath)
    {
        var fromEnvironment = Environment.GetEnvironmentVariable(ConfigPathEnvironmentVariable);
        var rawPath = !string.IsNullOrWhiteSpace(configPath)
            ? configPath
            : !string.IsNullOrWhiteSpace(fromEnvironment)
                ? fromEnvironment
                : Path.Combine(Environment.CurrentDirectory, "mcp_servers.json");

        return Path.GetFullPath(rawPath);
    }
}
