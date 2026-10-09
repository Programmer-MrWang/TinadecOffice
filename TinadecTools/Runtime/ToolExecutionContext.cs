using System.Text.Json;
using TinadecTools.Tools.FileRW;
using TinadecTools.Tools.Mcp;

namespace TinadecTools.Runtime;

/// <summary>
/// A host-owned, immutable snapshot for one call. Settings never change process environment or
/// shared static configuration: concurrent agents in the same workspace retain their own values.
/// This envelope is separate from model-authored params and is supplied only by the trusted host.
/// </summary>
internal sealed class ToolExecutionContext
{
    private static readonly AsyncLocal<ToolExecutionContext?> Ambient = new();
    private readonly JsonElement _document;
    private readonly HashSet<string> _allowedTools;
    public static ToolExecutionContext? Current => Ambient.Value;
    public static string? CurrentCallToolId => Ambient.Value?.ToolId;
    public IReadOnlyList<string> ReadRoots { get; }
    public IReadOnlyList<McpServerConfig> McpServers { get; }
    public string SettingsHash { get; }
    public string? RunId { get; }
    public string? ToolId { get; }

    private ToolExecutionContext(JsonElement document, string? toolId)
    {
        ToolId = toolId?.ToLowerInvariant();
        _document = document.Clone();
        if (_document.ValueKind != JsonValueKind.Object
            || !_document.TryGetProperty("schema_version", out var version) || version.GetInt32() != 1
            || !_document.TryGetProperty("settings", out var settings) || settings.ValueKind != JsonValueKind.Object
            || !_document.TryGetProperty("allowed_tool_ids", out var tools) || tools.ValueKind != JsonValueKind.Array)
            throw new InvalidOperationException("Invalid trusted execution_context schema.");
        SettingsHash = Text(_document, "settings_hash") ?? string.Empty;
        RunId = Text(_document, "run_id");
        if (RunId is not null && string.IsNullOrWhiteSpace(RunId))
            throw new InvalidOperationException("execution_context.run_id must be non-empty when provided.");
        _allowedTools = new HashSet<string>(tools.EnumerateArray().Select(item => item.GetString()
            ?? throw new InvalidOperationException("allowed_tool_ids must contain strings.")), StringComparer.OrdinalIgnoreCase);
        var roots = new List<string>();
        if (_document.TryGetProperty("read_roots", out var readRoots))
        {
            foreach (var root in readRoots.EnumerateArray())
            {
                var path = Text(root, "path") ?? throw new InvalidOperationException("read_roots requires path.");
                if (!Path.IsPathFullyQualified(path)) throw new InvalidOperationException("read_roots paths must be absolute.");
                roots.Add(WorkspaceRootSet.Normalize(path));
            }
        }
        ReadRoots = roots.AsReadOnly();
        var servers = new List<McpServerConfig>();
        if (_document.TryGetProperty("mcp_servers", out var resources))
        {
            foreach (var resource in resources.EnumerateArray())
            {
                var server = JsonSerializer.Deserialize(resource, McpJsonContext.Default.McpServerConfig)
                    ?? throw new InvalidOperationException("Invalid MCP resource.");
                if (string.IsNullOrWhiteSpace(server.Id) || string.IsNullOrWhiteSpace(server.Command))
                    throw new InvalidOperationException("MCP resources require id and command.");
                if (servers.Any(existing => !string.IsNullOrWhiteSpace(server.ResourceId)
                    && string.Equals(existing.ResourceId, server.ResourceId, StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidOperationException($"Duplicate MCP resource id '{server.ResourceId}'.");
                if (servers.Any(existing => existing.Id.Equals(server.Id, StringComparison.OrdinalIgnoreCase)
                    && (string.IsNullOrWhiteSpace(existing.ResourceId) || string.IsNullOrWhiteSpace(server.ResourceId))))
                    throw new InvalidOperationException($"Duplicate MCP server id '{server.Id}' requires distinct resource_ids.");
                servers.Add(server);
            }
        }
        McpServers = servers.AsReadOnly();
    }

    public static IDisposable Enter(JsonElement? document, string? toolId = null)
    {
        var previous = Ambient.Value;
        Ambient.Value = document is { ValueKind: not JsonValueKind.Null and not JsonValueKind.Undefined } value
            ? new ToolExecutionContext(value, toolId) : null;
        return new Restore(previous);
    }

    public void EnsureAllowed(string toolId)
    {
        // Reserved operations are private host control channels and never part of an agent catalog.
        if (toolId.StartsWith('#')) return;
        var category = Category(toolId);
        if (!_allowedTools.Contains(toolId) || (category is not null && !Boolean(category, "enabled", true)))
            throw new InvalidOperationException($"Tool '{toolId}' is disabled by the frozen execution context.");
        if (category == "mcp" && Text(_document, "mcp_import_error") is { Length: > 0 } importError)
            throw new InvalidOperationException($"MCP resources could not be imported: {importError}");
    }

    public JsonElement? Setting(string section, string name) =>
        _document.GetProperty("settings").TryGetProperty(section, out var value) && value.ValueKind == JsonValueKind.Object
        && value.TryGetProperty(name, out var setting) ? setting : null;

    public int Integer(string section, string name, int fallback, int min = 1, int max = int.MaxValue)
    {
        var setting = Setting(section, name);
        if (setting is null || setting.Value.ValueKind == JsonValueKind.Null) return fallback;
        if (!setting.Value.TryGetInt32(out var number) || number < min || number > max)
            throw new InvalidOperationException($"Invalid {section}.{name}; expected integer {min}..{max}.");
        return number;
    }

    public int IntegerForCurrentTool(string section, string name, int fallback, int min = 1, int max = int.MaxValue)
    {
        if (ToolId is not null && Setting(section, "tool_budgets") is { ValueKind: JsonValueKind.Object } budgets
            && budgets.TryGetProperty(ToolId, out var tool) && tool.ValueKind == JsonValueKind.Object
            && tool.TryGetProperty(name, out var value) && value.ValueKind != JsonValueKind.Null)
        {
            if (!value.TryGetInt32(out var number) || number < min || number > max)
                throw new InvalidOperationException($"Invalid {section}.tool_budgets.{ToolId}.{name}; expected integer {min}..{max}.");
            return number;
        }
        return Integer(section, name, fallback, min, max);
    }

    public bool Boolean(string section, string name, bool fallback) => Setting(section, name) is { } value
        ? value.ValueKind switch { JsonValueKind.True => true, JsonValueKind.False => false,
            _ => throw new InvalidOperationException($"Invalid {section}.{name}; expected boolean.") } : fallback;

    public string? String(string section, string name) => Setting(section, name) is { ValueKind: JsonValueKind.String } value
        ? value.GetString() : null;

    public IReadOnlyList<string>? Strings(string section, string name) => Setting(section, name) is { ValueKind: JsonValueKind.Array } value
        ? value.EnumerateArray().Select(item => item.GetString() ?? throw new InvalidOperationException($"Invalid {section}.{name}.")).ToArray() : null;

    public JsonElement ApplyDefaults(string toolId, JsonElement parameters)
    {
        if (parameters.ValueKind != JsonValueKind.Object) return parameters;
        var additions = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        void Default(string parameter, string section, string setting)
        {
            if (!parameters.TryGetProperty(parameter, out _) && Setting(section, setting) is { } value
                && value.ValueKind != JsonValueKind.Null) additions[parameter] = value;
        }
        switch (toolId.ToLowerInvariant())
        {
            case "shell": Default("timeout_ms", "shell", "timeout_ms"); break;
            case "command_run": Default("timeout_ms", "shell", "command_timeout_ms"); break;
            case "ls": Default("limit", "read", "directory_page_size"); break;
            case "file_search":
                Default("max_results", "search", "max_results");
                Default("context_lines", "search", "context_lines");
                Default("case_sensitive", "search", "case_sensitive");
                Default("fixed_strings", "search", "fixed_strings");
                Default("include_hidden", "search", "include_hidden");
                Default("respect_ignore_files", "search", "respect_ignore_files");
                break;
            case "web_fetch":
                Default("timeout_ms", "web", "timeout_ms"); Default("max_bytes", "web", "max_bytes");
                Default("max_chars", "web", "max_chars"); break;
            case "git_log": Default("limit", "git", "log_limit"); break;
            case "git_log_list": Default("limit", "git", "log_list_limit"); break;
        }
        if (additions.Count == 0) return parameters;
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            foreach (var property in parameters.EnumerateObject()) property.WriteTo(writer);
            foreach (var addition in additions) { writer.WritePropertyName(addition.Key); addition.Value.WriteTo(writer); }
            writer.WriteEndObject();
        }
        using var result = JsonDocument.Parse(stream.ToArray());
        return result.RootElement.Clone();
    }

    public static void CheckFileSize(string section, long bytes)
    {
        var current = Current;
        if (current?.Setting(section, "max_file_bytes") is not { ValueKind: JsonValueKind.Number }) return;
        var maximum = current.Integer(section, "max_file_bytes", int.MaxValue);
        if (bytes > maximum) throw new InvalidOperationException($"File exceeds {section}.max_file_bytes ({maximum} bytes).");
    }

    private static string? Text(JsonElement value, string name) => value.TryGetProperty(name, out var text)
        && text.ValueKind == JsonValueKind.String ? text.GetString() : null;
    private static string? Category(string toolId) => toolId.ToLowerInvariant() switch
    {
        "shell" or "command_run" or "sandbox_status" or "sandbox_reset" => "shell",
        "read_file" or "ls" or "stat" => "read",
        "write_file" or "delete_file" or "replace_lines" or "replace_bytes" or "insert_line" or "delete_line" or "insert_bytes" or "insert_byte" or "delete_bytes" => "write",
        "file_search" => "search", "web_fetch" => "web",
        var id when id.StartsWith("git_") => "git", var id when id.StartsWith("mcp_") => "mcp", _ => null
    };
    private sealed class Restore(ToolExecutionContext? previous) : IDisposable
    {
        public void Dispose() => Ambient.Value = previous;
    }
}
