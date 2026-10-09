using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;
using Tomlyn;
using Tomlyn.Model;

namespace TinadecCore.Runtime;

internal static partial class WorkspaceDefinitionFile
{
    internal static readonly string[] Icons = ["folder", "code", "book", "briefcase", "flask", "rocket", "layers", "bot", "globe", "palette", "terminal", "database"];
    internal static readonly string[] Colors = ["default", "blue", "green", "yellow", "orange", "red", "pink", "purple", "teal"];
    internal static string FilePath(StorageScopeDescriptor scope) => System.IO.Path.Combine(scope.Root, "project.toml");
    internal static string Hash(string text) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));

    internal static async Task<FileStream> AcquireWriteLeaseAsync(StorageScopeDescriptor scope, CancellationToken ct)
    {
        var state = System.IO.Path.Combine(scope.Root, "state");
        var path = System.IO.Path.Combine(state, ".workspace-write.lock");
        StorageScopePaths.RejectLinks(scope.Root, path);
        Directory.CreateDirectory(state);
        for (var attempt = 0; ; attempt++)
        {
            ct.ThrowIfCancellationRequested();
            try { return new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
            catch (IOException) when (attempt < 200) { await Task.Delay(25, ct).ConfigureAwait(false); }
        }
    }

    // The caller keeps the workspace lease until the host registration is published.
    internal static async Task WriteIfMatchAsync(StorageScopeDescriptor scope, string text, string expectedHash, CancellationToken ct)
    {
        var path = FilePath(scope);
        var temporary = path + ".tmp-" + Guid.NewGuid().ToString("N");
        try
        {
            await using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None,
                4096, FileOptions.Asynchronous | FileOptions.WriteThrough))
            {
                await output.WriteAsync(Encoding.UTF8.GetBytes(text), ct).ConfigureAwait(false);
                await output.FlushAsync(ct).ConfigureAwait(false);
                output.Flush(flushToDisk: true);
            }
            StorageScopePaths.RejectLinks(scope.Root, path);
            if (Hash(await File.ReadAllTextAsync(path, ct).ConfigureAwait(false)) != expectedHash)
                throw new ConfigurationDocumentException("configuration_conflict", "project.toml changed. Reload the workspace before saving.",
                    [new("workspace_conflict", path)]);
            ct.ThrowIfCancellationRequested();
            File.Move(temporary, path, overwrite: true);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }

    internal static WorkspaceDefinition Read(StorageScopeDescriptor scope, string fallbackName)
    {
        var file = FilePath(scope);
        StorageScopePaths.RejectLinks(scope.Root, file);
        var text = File.ReadAllText(file);
        var model = TomlSerializer.Deserialize<TomlTable>(text) ?? throw new InvalidDataException("Empty project.toml.");
        if (StorageScopeInitializer.Value(model, "workspace") is not TomlTable workspace)
            return new(fallbackName, [new("primary", scope.ProjectRoot!)], "primary", ContentHash: Hash(text));
        if (StorageScopeInitializer.Value(workspace, "roots") is not TomlTableArray roots)
            throw new InvalidDataException("project.toml workspace.roots is required.");
        var definition = new WorkspaceDefinition(Text(workspace, "name"), roots.Select(root =>
            new WorkspaceSourceRoot(Text(root, "id"), System.IO.Path.GetFullPath(Text(root, "path"), scope.ProjectRoot!))).ToArray(),
            Text(workspace, "primary_root_id"), Text(workspace, "icon", "folder"), Text(workspace, "color", "default"), Hash(text));
        return Validate(definition, requireAvailable: false);
    }

    internal static WorkspaceDefinition Validate(WorkspaceDefinition definition, bool requireAvailable = true)
    {
        if (string.IsNullOrWhiteSpace(definition.Name) || definition.Name.Trim().Length > 128)
            throw new ArgumentException("Workspace name requires 1–128 characters.");
        if (definition.Roots.Count is < 1 or > 32) throw new ArgumentException("A workspace requires 1–32 source folders.");
        if (!Icons.Contains(definition.Icon) || !Colors.Contains(definition.Color)) throw new ArgumentException("Unknown workspace icon or color.");
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var paths = new List<string>();
        var normalized = new List<WorkspaceSourceRoot>();
        foreach (var root in definition.Roots)
        {
            if (!RootId().IsMatch(root.Id) || !ids.Add(root.Id)) throw new ArgumentException("Source folder IDs must be unique and contain 1–64 letters, digits, '_' or '-'.");
            if (!System.IO.Path.IsPathFullyQualified(root.Path)) throw new ArgumentException("Source folders require absolute paths.");
            var path = WorkspacePathSpelling.Canonical(root.Path);
            if (paths.Any(previous => StorageScopeInitializer.SamePath(previous, path))) throw new ArgumentException("The same source folder cannot be added twice: " + path);
            if (StorageScopeInitializer.SamePath(path, System.IO.Path.GetPathRoot(path)!)) throw new ArgumentException("A filesystem root cannot be a source folder.");
            if (requireAvailable && !Directory.Exists(path)) throw new DirectoryNotFoundException("Source folder is unavailable: " + path);
            paths.Add(path); normalized.Add(root with { Path = path });
        }
        if (!ids.Contains(definition.PrimaryRootId)) throw new ArgumentException("The primary folder must belong to this workspace.");
        return definition with { Name = definition.Name.Trim(), Roots = normalized };
    }

    // Edit owned values in place rather than serializing unrelated manifest fields and comments.
    internal static string Write(string text, WorkspaceDefinition definition, string anchor)
    {
        var oldRoots = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (Match match in RootSections().Matches(text))
        {
            var table = TomlSerializer.Deserialize<TomlTable>(match.Value);
            if (table?["workspace"] is TomlTable workspace && workspace["roots"] is TomlTableArray rows
                && rows.Count == 1) oldRoots[Text(rows[0], "id")] = match.Value;
        }
        text = RootSections().Replace(text, "");
        var section = WorkspaceSection().Match(text);
        var body = section.Success ? section.Value : "[workspace]\n";
        body = Set(body, "name", definition.Name);
        body = Set(body, "primary_root_id", definition.PrimaryRootId);
        body = Set(body, "icon", definition.Icon);
        body = Set(body, "color", definition.Color);
        text = section.Success ? text[..section.Index] + body + text[(section.Index + section.Length)..]
            : text.TrimEnd() + "\n\n" + body;
        foreach (var root in definition.Roots)
        {
            var row = oldRoots.GetValueOrDefault(root.Id, "[[workspace.roots]]\n");
            row = Set(Set(row, "id", root.Id), "path", System.IO.Path.GetRelativePath(anchor, root.Path).Replace('\\', '/'));
            text = text.TrimEnd() + "\n\n" + row;
        }
        _ = TomlSerializer.Deserialize<TomlTable>(text);
        return text;
    }
    private static string Set(string section, string key, string value)
    {
        var match = Regex.Match(section, @"(?m)^" + Regex.Escape(key) + @"\s*=\s*(?:""(?:\\.|[^""\\])*""|'[^']*'|[^#\r\n]*)([^\r\n]*)\r?$");
        var scalar = key + " = " + JsonSerializer.Serialize(value);
        return match.Success ? section[..match.Index] + scalar + match.Groups[1].Value + section[(match.Index + match.Length)..]
            : section.TrimEnd() + "\n" + scalar + "\n";
    }
    private static string Text(TomlTable table, string key, string? fallback = null) =>
        StorageScopeInitializer.Value(table, key)?.ToString() ?? fallback ?? throw new InvalidDataException("Missing workspace field: " + key);
    [GeneratedRegex(@"^[a-zA-Z0-9_-]{1,64}$")] private static partial Regex RootId();
    [GeneratedRegex(@"(?ms)^\[workspace\][^\r\n]*\r?\n.*?(?=^\[|\z)")] private static partial Regex WorkspaceSection();
    [GeneratedRegex(@"(?ms)^\[\[workspace\.roots\]\][^\r\n]*\r?\n.*?(?=^\[|\z)")] private static partial Regex RootSections();
}
