using System.Collections.Concurrent;
using System.Text;
using TinadecTools.Tools.FileRW;
using Tomlyn;
using Tomlyn.Model;
using Tomlyn.Serialization;

namespace TinadecTools.Runtime.Sandbox;

// Standalone Tools' approved grant history is runtime state. Governed calls only use
// the host's frozen execution context and never read, persist, or reset this history.
internal static class SandboxPolicyStore
{
    internal const int CurrentVersion = 1;
    internal const int MaxBytes = 262_144;
    private static readonly ConcurrentDictionary<string, object> Gates = new(SandboxPaths.PathComparer);
    private static readonly string[] Fields = ["version", "read_paths", "write_paths", "environment_variables"];
    private static readonly UTF8Encoding Encoding = new(false, true);

    internal static string FilePath(string? storageRoot = null) => Path.Combine(Root(storageRoot), "state", "sandbox-grants.toml");
    private static string Root(string? storageRoot) => Path.GetFullPath(storageRoot ?? WorkspaceStoragePolicy.StorageRoot(WorkspacePathResolver.WorkspaceRoot));

    internal static SandboxPolicyFile Load(string? storageRoot = null)
    {
        if (ToolExecutionContext.Current is not null) return new() { Version = CurrentVersion };
        var path = FilePath(storageRoot);
        lock (Gates.GetOrAdd(path, static _ => new()))
        {
            EnsureNoLinks(path);
            if (!File.Exists(path)) return new() { Version = CurrentVersion };
            try
            {
                using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
                if (stream.Length > MaxBytes) throw new InvalidDataException("Sandbox grant history exceeds its byte limit.");
                using var reader = new StreamReader(stream, Encoding, detectEncodingFromByteOrderMarks: true);
                var table = TomlSerializer.Deserialize(reader.ReadToEnd(), SandboxGrantTomlContext.Default.TomlTable)
                    ?? throw new InvalidDataException("Sandbox grant history requires a TOML table.");
                if (table.Count != Fields.Length || table.Keys.Any(key => !Fields.Contains(key, StringComparer.Ordinal))
                    || table["version"] is not long version || version != CurrentVersion)
                    throw new InvalidDataException("Sandbox grant history has unknown fields or an unsupported version.");
                var policy = new SandboxPolicyFile { Version = CurrentVersion,
                    ReadPaths = Strings(table, "read_paths"), WritePaths = Strings(table, "write_paths"),
                    EnvironmentVariables = Strings(table, "environment_variables") };
                Validate(policy);
                return policy;
            }
            catch (Exception ex) when (ex is not IOException && ex is not UnauthorizedAccessException)
            {
                throw new InvalidDataException($"Invalid sandbox grant history at '{path}': {ex.Message}", ex);
            }
        }
    }

    internal static SandboxPolicyFile MergeGrants(SandboxPermissions permissions, SandboxPolicyFile? existing = null)
    {
        existing ??= Load();
        existing.ReadPaths = Union(existing.ReadPaths, permissions.ReadPaths);
        existing.WritePaths = Union(existing.WritePaths, permissions.WritePaths);
        existing.EnvironmentVariables = Union(existing.EnvironmentVariables, permissions.EnvironmentVariableNames);
        existing.Version = CurrentVersion;
        return existing;
    }

    internal static void Save(SandboxPolicyFile policy, string? storageRoot = null)
    {
        if (ToolExecutionContext.Current is not null)
            throw new InvalidOperationException("Governed calls cannot persist standalone sandbox grant history.");
        Validate(policy);
        var table = new TomlTable { ["version"] = (long)policy.Version,
            ["read_paths"] = Array(policy.ReadPaths), ["write_paths"] = Array(policy.WritePaths),
            ["environment_variables"] = Array(policy.EnvironmentVariables) };
        var bytes = Encoding.GetBytes(TomlSerializer.Serialize(table, SandboxGrantTomlContext.Default.TomlTable));
        if (bytes.Length > MaxBytes) throw new InvalidDataException("Sandbox grant history exceeds its byte limit.");
        var path = FilePath(storageRoot);
        lock (Gates.GetOrAdd(path, static _ => new()))
        {
            EnsureNoLinks(path);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            EnsureNoLinks(path);
            var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
                { output.Write(bytes); output.Flush(flushToDisk: true); }
                EnsureNoLinks(path);
                File.Move(temporary, path, overwrite: true);
            }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }
        }
    }

    internal static void Delete(string? storageRoot = null)
    {
        if (ToolExecutionContext.Current is not null) return;
        var path = FilePath(storageRoot);
        lock (Gates.GetOrAdd(path, static _ => new()))
        {
            EnsureNoLinks(path);
            try { File.Delete(path); } catch (DirectoryNotFoundException) { }
        }
    }

    internal static SandboxPolicyFile MergeAndPersist(SandboxPermissions permissions, string? storageRoot = null)
    {
        var path = FilePath(storageRoot);
        lock (Gates.GetOrAdd(path, static _ => new()))
        {
            var merged = MergeGrants(permissions, Load(storageRoot)); Save(merged, storageRoot); return merged;
        }
    }

    private static List<string> Strings(TomlTable table, string key)
    {
        if (!table.TryGetValue(key, out var value) || value is not TomlArray array || array.Count > 256)
            throw new InvalidDataException($"Sandbox grant '{key}' must be an array with at most 256 strings.");
        return array.Select(item => item is string { Length: > 0 and <= 4096 } text ? text
            : throw new InvalidDataException($"Sandbox grant '{key}' requires nonempty strings.")).ToList();
    }

    private static void Validate(SandboxPolicyFile policy)
    {
        if (policy.Version != CurrentVersion) throw new InvalidDataException("Unsupported sandbox grant version.");
        foreach (var paths in new[] { policy.ReadPaths, policy.WritePaths })
        {
            if (paths.Count > 256 || paths.Any(path => string.IsNullOrWhiteSpace(path) || path.Length > 4096 || !Path.IsPathFullyQualified(path)))
                throw new InvalidDataException("Sandbox grant paths require bounded absolute paths.");
        }
        foreach (var path in policy.WritePaths)
        {
            SandboxPaths.EnsureNotBroadWriteTarget(path);
            if (!WorkspaceStoragePolicy.CanAccess(WorkspacePathResolver.WorkspaceRoot, WorkspacePathForm.Canonical(path), true, []))
                throw new UnauthorizedAccessException("Persisted sandbox grants cannot authorize protected storage writes.");
        }
        if (policy.EnvironmentVariables.Count > 256 || policy.EnvironmentVariables.Any(name => name.Length > 4096
            || !SandboxEnvironment.IsEnvironmentVariableNameValid(name) || name.Equals("TINADEC_HOST_CONTROL_TOKEN", StringComparison.OrdinalIgnoreCase)))
            throw new InvalidDataException("Sandbox grant environment names are invalid or reserved.");
    }

    private static void EnsureNoLinks(string path)
    {
        for (var current = path; current is not null; current = Path.GetDirectoryName(current))
        {
            try { if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) throw new IOException("Sandbox grant history cannot use linked paths."); }
            catch (FileNotFoundException) { }
            catch (DirectoryNotFoundException) { }
        }
    }
    private static TomlArray Array(IEnumerable<string> values) { var array = new TomlArray(); foreach (var value in values) array.Add(value); return array; }
    private static List<string> Union(IEnumerable<string> existing, IEnumerable<string> additions) => [.. existing.Concat(additions)
        .Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => Path.IsPathFullyQualified(s) && SandboxPaths.IsDiskRoot(s)
            ? Path.GetPathRoot(s)! : s.TrimEnd('\\', '/'))
        .Distinct(SandboxPaths.PathComparer).OrderBy(s => s, StringComparer.Ordinal)];
}

[TomlSerializable(typeof(TomlTable))]
internal partial class SandboxGrantTomlContext : TomlSerializerContext { }
