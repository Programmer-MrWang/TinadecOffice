using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace TinadecCore.Abstractions.Ports;

/// <summary>The settings catalog and runtime index share these discovery and boundary checks.</summary>
public static class WorkspaceSkillDiscovery
{
    public sealed record Entry(string Name, string Description, string RelativePath, string FullPath,
        string? Content, string ContentHash, bool Enabled, bool Valid, string? Reason);

    public static IReadOnlyList<Entry> Discover(string rootPath, IReadOnlyList<string>? skillRoots = null)
    {
        var entries = new List<Entry>();
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var skillRoot in skillRoots ?? WorkspaceSkillPolicy.SkillRoots)
            Walk(Path.GetFullPath(Path.Combine(rootPath, skillRoot)), 0);
        return entries;

        void Walk(string directory, int depth)
        {
            if (depth > WorkspaceSkillPolicy.SearchDepth || !Directory.Exists(directory)) return;
            try
            {
                if (!IsContained(rootPath, directory))
                {
                    entries.Add(new(Path.GetFileName(directory), "", Path.GetRelativePath(rootPath, directory), directory,
                        null, "", false, false, "directory link resolves outside the workspace root"));
                    return;
                }
                var file = Path.Combine(directory, WorkspaceSkillPolicy.SkillFileName);
                if (depth >= 1 && File.Exists(file))
                {
                    var entry = Read(rootPath, file);
                    if (entry.Valid && !names.Add(entry.Name))
                        entry = entry with { Valid = false, Reason = $"another skill already claims the name '{entry.Name}'" };
                    entries.Add(entry);
                    return;
                }
                foreach (var child in Directory.GetDirectories(directory).Order(StringComparer.Ordinal)) Walk(child, depth + 1);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
            {
                entries.Add(new(Path.GetFileName(directory), "", Path.GetRelativePath(rootPath, directory), directory,
                    null, "", false, false, "directory could not be read"));
            }
        }
    }

    public static Entry Read(string rootPath, string path)
    {
        var name = Path.GetFileName(Path.GetDirectoryName(path)) ?? "";
        var relative = Path.GetRelativePath(rootPath, path).Replace('\\', '/');
        try
        {
            if (!IsContained(rootPath, path)) return Invalid("path or link resolves outside the workspace root");
            if (new FileInfo(path).Length > WorkspaceSkillPolicy.MaxFileBytes)
                return Invalid($"is larger than {WorkspaceSkillPolicy.MaxFileBytes} bytes");
            var content = File.ReadAllText(path);
            var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(content)));
            var enabled = true;
            var parse = content;
            if (!WorkspaceSkillPolicy.TryRead(parse, name, relative, out var skill, out var reason)
                && reason.Contains("marked off", StringComparison.Ordinal))
            {
                enabled = false;
                parse = SetEnabled(content, true);
                WorkspaceSkillPolicy.TryRead(parse, name, relative, out skill, out reason);
            }
            return new(name, skill?.Description ?? "", relative, path, content, hash, enabled, skill is not null,
                skill is null ? reason : enabled ? null : "disabled in SKILL.md frontmatter");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        { return Invalid("could not be read"); }
        Entry Invalid(string reason) => new(name, "", relative, path, null, "", false, false, reason);
    }

    public static string SetEnabled(string content, bool enabled)
    {
        var end = Regex.Match(content, @"\A\uFEFF?---[^\n]*\n(?<front>.*?)^---\s*$", RegexOptions.Singleline | RegexOptions.Multiline,
            TimeSpan.FromSeconds(1));
        if (!end.Success) return content;
        var front = end.Groups["front"];
        var cleaned = Regex.Replace(front.Value, @"^\s*disabled\s*:[^\n]*\n?", "", RegexOptions.Multiline | RegexOptions.IgnoreCase,
            TimeSpan.FromSeconds(1));
        return content[..front.Index] + cleaned + (enabled ? "" : "disabled: true\n") + content[(front.Index + front.Length)..];
    }

    public static bool IsContained(string rootPath, string path)
    {
        var root = WorkspacePathSpelling.Canonical(Path.GetFullPath(rootPath)).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var full = WorkspacePathSpelling.Canonical(Path.GetFullPath(path));
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        if (!full.Equals(root, comparison) && !full.StartsWith(root + Path.DirectorySeparatorChar, comparison)) return false;
        // Canonical resolves directory links in every existing ancestor; files need a final
        // link check too. This also accepts /var versus /private/var and Windows junction roots.
        var info = new FileInfo(full);
        if (info.Exists && info.ResolveLinkTarget(true) is { } target)
        {
            var resolved = WorkspacePathSpelling.Canonical(target.FullName);
            if (!resolved.Equals(root, comparison) && !resolved.StartsWith(root + Path.DirectorySeparatorChar, comparison)) return false;
        }
        return true;
    }
}
