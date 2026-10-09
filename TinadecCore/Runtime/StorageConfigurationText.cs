using System.Text.RegularExpressions;
using Tomlyn;

namespace TinadecCore.Runtime;

internal static class StorageConfigurationText
{
    public static string Set(string text, string key, string? value)
    {
        var start = Regex.Match(text, @"(?m)^\[storage\][^\r\n]*\r?\n");
        if (!start.Success) throw new InvalidDataException("storage.toml requires [storage].");
        var offset = start.Index + start.Length;
        var next = Regex.Match(text[offset..], @"(?m)^\[");
        var length = next.Success ? next.Index : text.Length - offset;
        var section = text.Substring(offset, length);
        var scalar = value is null ? null : System.Text.Json.JsonSerializer.Serialize(value);
        var match = Regex.Match(section, @"(?m)^" + Regex.Escape(key) + @"\s*=\s*([^\r\n]*?)(\s+#.*)?\r?$");
        if (match.Success) section = section[..match.Index] + (scalar is null ? "# " + match.Value : key + " = " + scalar + match.Groups[2].Value) + section[(match.Index + match.Length)..];
        else if (scalar is not null) section += (section.EndsWith('\n') ? "" : "\n") + key + " = " + scalar + "\n";
        var updated = text[..offset] + section + text[(offset + length)..];
        _ = TomlSerializer.Deserialize<object>(updated);
        return updated;
    }
}
