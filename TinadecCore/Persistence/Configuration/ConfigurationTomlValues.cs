using System.Text.Json;
using Tomlyn.Model;

namespace TinadecCore.Persistence;

/// <summary>Maps explicit native editing values to internal JSON projections; JSON null is never a TOML value.</summary>
public static class ConfigurationTomlValues
{
    public static JsonElement ToJsonElement(object? value, bool toolSettings = false) => JsonSerializer.SerializeToElement(ToJson(value, toolSettings, ""));

    public static object? FromJsonElement(JsonElement value, bool toolSettings = false) => FromJson(value, toolSettings, "");

    private static object? FromJson(JsonElement value, bool toolSettings, string path) => value.ValueKind switch
    {
        JsonValueKind.Object => FromObject(value, toolSettings, path),
        JsonValueKind.Array => FromArray(value, toolSettings, path),
        JsonValueKind.String => value.GetString(),
        JsonValueKind.Number => value.TryGetInt64(out var integer) ? (object)integer : value.GetDouble(),
        JsonValueKind.True => true, JsonValueKind.False => false,
        JsonValueKind.Null => null,
        _ => throw Invalid(path, "The configuration value is undefined.")
    };

    private static TomlTable FromObject(JsonElement value, bool toolSettings, string path)
    {
        var result = new TomlTable();
        foreach (var property in value.EnumerateObject())
        {
            RejectSentinel(property.Name, path);
            var field = Join(path, property.Name);
            if (toolSettings && IsBindingField(path, property.Name))
            {
                if (result.ContainsKey("binding") || value.TryGetProperty("binding", out _))
                    throw Invalid(field, "Use only one resource binding field.");
                result["binding"] = FromBinding(property.Value, field);
            }
            else if (toolSettings && OptionalMode(field) is { } mode && property.Value.ValueKind == JsonValueKind.Null)
                result[property.Name] = new TomlTable { ["mode"] = mode };
            // Omitted object fields inherit. Explicit resource/optional-value intent
            // above has a named native contract rather than a generic null marker.
            else if (property.Value.ValueKind != JsonValueKind.Null)
                result[property.Name] = FromJson(property.Value, toolSettings, field)!;
        }
        if (toolSettings && (path is "mcp" or "skills") && !result.ContainsKey("binding"))
            result["binding"] = new TomlTable { ["mode"] = "inherit" };
        return result;
    }

    private static TomlArray FromArray(JsonElement value, bool toolSettings, string path)
    {
        var result = new TomlArray();
        foreach (var item in value.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.Null) throw Invalid(path, "Null array elements have no native TOML editing meaning; use an explicit domain value.");
            result.Add(FromJson(item, toolSettings, path)!);
        }
        return result;
    }

    private static TomlTable FromBinding(JsonElement value, string path)
    {
        if (value.ValueKind == JsonValueKind.Null) return new() { ["mode"] = "all" };
        if (value.ValueKind != JsonValueKind.Array) throw Invalid(path, "The internal binding projection must be a resource array.");
        if (value.GetArrayLength() == 0) return new() { ["mode"] = "none" };
        var binding = new TomlTable { ["mode"] = "selected", ["ids"] = FromArray(value, false, path) };
        _ = ToBinding(binding, path);
        return binding;
    }

    private static object? ToJson(object? value, bool toolSettings, string path) => value switch
    {
        TomlTable table => ToObject(table, toolSettings, path),
        TomlArray array => array.Select(item => ToJson(item, toolSettings, path)).ToArray(),
        TomlTableArray array => array.Select(item => ToJson(item, toolSettings, path)).ToArray(),
        _ => value
    };

    private static Dictionary<string, object?> ToObject(TomlTable table, bool toolSettings, string path)
    {
        var result = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var (key, value) in table)
        {
            RejectSentinel(key, path);
            var field = Join(path, key);
            if (toolSettings && IsBindingField(path, key))
                throw Invalid(field, "Editable TOML resource bindings use binding.mode and binding.ids, not JSON resource_ids fields.");
            if (toolSettings && (path is "mcp" or "skills") && key == "binding")
            {
                if (value is not TomlTable binding) throw Invalid(field, "A resource binding must be a table.");
                var (inherit, ids) = ToBinding(binding, field);
                if (!inherit) result[path == "mcp" ? "server_resource_ids" : "resource_ids"] = ids;
            }
            else if (toolSettings && OptionalMode(field) is { } mode && value is TomlTable optional)
            {
                if (optional.Count != 1 || !optional.TryGetValue("mode", out var state) || state is not string selected || selected != mode)
                    throw Invalid(field, "The explicit default mode must be '" + mode + "'. Omit the field to inherit.");
                result[key] = null;
            }
            else result[key] = ToJson(value, toolSettings, field);
        }
        return result;
    }

    private static (bool Inherit, string[]? Ids) ToBinding(TomlTable binding, string path)
    {
        if (binding.Keys.Any(key => key is not ("mode" or "ids")) || !binding.TryGetValue("mode", out var raw) || raw is not string mode)
            throw Invalid(path, "A binding requires mode = inherit, all, none or selected; only ids is also supported.");
        if (mode is "inherit" or "all" or "none")
        {
            if (binding.ContainsKey("ids")) throw Invalid(path, "Only selected bindings may include ids.");
            return mode switch { "inherit" => (true, null), "all" => (false, null), _ => (false, []) };
        }
        if (mode != "selected" || !binding.TryGetValue("ids", out var value) || value is not TomlArray array || array.Count is < 1 or > 1000)
            throw Invalid(path, "Selected bindings require a nonempty array of at most 1000 resource UUIDs.");
        var ids = new List<string>(); var unique = new HashSet<Guid>();
        foreach (var item in array)
        {
            if (item is not string text || !Guid.TryParse(text, out var id) || id == Guid.Empty || !unique.Add(id))
                throw Invalid(path, "Selected bindings require unique, nonzero resource UUIDs.");
            ids.Add(id.ToString());
        }
        return (false, ids.ToArray());
    }

    private static bool IsBindingField(string section, string field) => section == "mcp" && field == "server_resource_ids" || section == "skills" && field == "resource_ids";
    private static string? OptionalMode(string field) => field switch
    {
        "read.max_file_bytes" or "write.max_file_bytes" => "unlimited",
        "search.timeout_ms" => "outer_deadline", "search.rg_path" => "host_search", _ => null
    };
    private static string Join(string parent, string field) => parent.Length == 0 ? field : parent + "." + field;
    private static void RejectSentinel(string key, string path)
    {
        if (key == "__tinadec_null") throw Invalid(path, "JSON null sentinels are not editable configuration. Omit inherited fields or use an explicit domain mode.");
    }
    private static InvalidDataException Invalid(string path, string message) => new(path + ": " + message);
}
