using System.Text.Json;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;
using Tomlyn;
using Tomlyn.Model;

namespace TinadecCore.Tools;

internal sealed class ToolSettingsDocumentValidator : IConfigurationDocumentValidator
{
    public string DocumentId => "tools";
    public IReadOnlyList<ConfigurationDiagnostic> Validate(string text)
    {
        if (string.IsNullOrEmpty(text)) return [];
        try
        {
            var root = TomlSerializer.Deserialize<TomlTable>(text)!;
            var live = new List<(string Scope, JsonElement Settings)>();
            foreach (var tableName in new[] { "tool_settings", "tool_settings_versions" })
            {
                if (!root.TryGetValue(tableName, out var value) || value is not TomlTableArray rows) continue;
                foreach (var row in rows)
                {
                    if (!row.TryGetValue("settings", out var raw)) continue;
                    var settings = tableName == "tool_settings_versions" && raw is string frozen
                        ? JsonSerializer.Deserialize<JsonElement>(frozen) : ConfigurationTomlValues.ToJsonElement(raw, tableName == "tool_settings");
                    ToolSettingsSchema.Validate(settings);
                    if (tableName == "tool_settings") live.Add((row.TryGetValue("scope_key", out var scope) ? scope.ToString()! : "shared", settings));
                }
            }
            var shared = live.Where(x => x.Scope == "shared").Select(x => x.Settings).FirstOrDefault();
            var effective = ToolSettingsSchema.Merge(ToolSettingsSchema.Defaults, shared.ValueKind == JsonValueKind.Undefined ? ToolSettingsStore.Empty : shared);
            foreach (var row in live.Where(x => x.Scope != "shared")) ToolSettingsSchema.MergeAgent(effective, row.Settings);
            return [];
        }
        catch (Exception ex) when (ex is ToolSettingsException or TomlException or JsonException or InvalidDataException)
        { return [new("tool_configuration_invalid", ex.Message)]; }
    }
}
