using System.Security.Cryptography;
using System.Text;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;

namespace TinadecCore.Skills;

/// <summary>Retains the project package bytes a run admitted, while management keeps live project paths.</summary>
internal static class ProjectSkillPackageCapture
{
    private const int MaxFiles = 256;
    private const long MaxBytes = 16 * 1024 * 1024;

    internal sealed record CapturedPackage(string RootPath, string ContentHash);

    public static async Task<CapturedPackage> CaptureAsync(StoragePaths storage, Guid tenantId, Guid workspaceId,
        string name, string sourceRoot, string expectedBodyHash, CancellationToken cancellationToken, string category = "project-skills")
    {
        var files = new SortedDictionary<string, byte[]>(StringComparer.Ordinal);
        long bytes = 0;
        await Walk(sourceRoot);
        if (!files.TryGetValue("SKILL.md", out var body)) throw Changed();
        using (var stream = new MemoryStream(body))
        using (var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true))
        {
            var normalized = Encoding.UTF8.GetBytes(await reader.ReadToEndAsync(cancellationToken));
            var bodyHash = Convert.ToHexStringLower(SHA256.HashData(normalized));
            if (!string.Equals(bodyHash, expectedBodyHash, StringComparison.Ordinal)) throw Changed();
        }
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        foreach (var file in files)
        {
            hash.AppendData(Encoding.UTF8.GetBytes(file.Key + "\0"));
            hash.AppendData(SHA256.HashData(file.Value));
        }
        var digest = Convert.ToHexStringLower(hash.GetHashAndReset());
        var target = Path.Combine(storage.Locations.Packages, category, digest);
        var retainedRoot = Path.Combine(target, name);
        if (Directory.Exists(retainedRoot)) return new(retainedRoot, digest);
        var temporary = Path.Combine(storage.Locations.Temp, "project-skills", Guid.NewGuid().ToString("N"));
        try
        {
            var package = Path.Combine(temporary, name);
            foreach (var file in files)
            {
                var output = Path.Combine(package, file.Key.Replace('/', Path.DirectorySeparatorChar));
                Directory.CreateDirectory(Path.GetDirectoryName(output)!);
                await File.WriteAllBytesAsync(output, file.Value, cancellationToken);
            }
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            try { Directory.Move(temporary, target); }
            catch (IOException) when (Directory.Exists(retainedRoot)) { }
            return new(retainedRoot, digest);
        }
        finally
        {
            if (Directory.Exists(temporary) && WorkspaceSkillDiscovery.IsContained(storage.Locations.Temp, temporary))
                Directory.Delete(temporary, recursive: true);
        }

        async Task Walk(string directory)
        {
            foreach (var path in Directory.EnumerateFileSystemEntries(directory).Order(StringComparer.Ordinal))
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (!WorkspaceSkillDiscovery.IsContained(sourceRoot, path)
                    || (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
                    throw new ToolSettingsException("skill_path_escape", "Project Skill packages cannot capture linked or escaping assets.");
                if (Directory.Exists(path)) { await Walk(path); continue; }
                if (files.Count >= MaxFiles || new FileInfo(path).Length > MaxBytes - bytes)
                    throw new ToolSettingsException("skill_package_budget", "Skill packages are limited to 256 files and 16 MiB.");
                var data = await File.ReadAllBytesAsync(path, cancellationToken);
                bytes += data.LongLength;
                if (bytes > MaxBytes) throw new ToolSettingsException("skill_package_budget", "Skill packages are limited to 256 files and 16 MiB.");
                files.Add(Path.GetRelativePath(sourceRoot, path).Replace('\\', '/'), data);
            }
        }
        static ToolSettingsException Changed() => new("skill_changed_during_capture", "The project Skill changed during admission; retry the run.", 409);
    }
}
