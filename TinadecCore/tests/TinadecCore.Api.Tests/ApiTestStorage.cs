using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;

namespace TinadecCore.Api.Tests;

/// <summary>
/// One process-owned fallback, installed before any test can construct default
/// persistence options. Factories never temporarily replace TINADEC_HOME.
/// </summary>
public static class ApiTestStorage
{
    private static readonly StringComparison PathComparison = OperatingSystem.IsWindows()
        ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
    private static readonly string? PreviousHome = Environment.GetEnvironmentVariable("TINADEC_HOME");
    private static readonly string TemporaryParent = WorkspacePathSpelling.Canonical(Path.GetTempPath());
    public static string ProcessRoot { get; } = Path.Combine(TemporaryParent, "tinadec-api-test-process", Guid.NewGuid().ToString("N"));
    public static string Home { get; } = Path.Combine(ProcessRoot, "user");
    private static readonly string[] OriginalUserRoots = new[]
    {
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".tinadec"),
        string.IsNullOrWhiteSpace(PreviousHome) ? null : Path.GetFullPath(PreviousHome)
    }.Where(root => root is not null).Select(root => WorkspacePathSpelling.Canonical(root!)).Distinct(
        OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal).ToArray();

    [ModuleInitializer]
    public static void Initialize()
    {
        // Exactly once per test process; parallel factories share this safe
        // fallback and still use their own explicit databases/scope roots.
        ValidateTemporaryPath(ProcessRoot);
        Directory.CreateDirectory(Home);
        Directory.CreateDirectory(Path.Combine(Home, "workspace"));
        Environment.SetEnvironmentVariable("TINADEC_HOME", Home);
        AppDomain.CurrentDomain.ProcessExit += (_, _) =>
        {
            if (string.Equals(Environment.GetEnvironmentVariable("TINADEC_HOME"), Home, PathComparison))
                Environment.SetEnvironmentVariable("TINADEC_HOME", PreviousHome);
            try
            {
                if (!string.Equals(ValidateTemporaryPath(ProcessRoot), ProcessRoot, PathComparison))
                    return; // Never follow a replacement link during teardown.
                if (Directory.Exists(ProcessRoot)) Directory.Delete(ProcessRoot, recursive: true);
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            catch (InvalidOperationException) { }
        };
    }

    public static string CreateRoot(string label)
    {
        AssertFallbackIsActive();
        if (string.IsNullOrWhiteSpace(label) || label.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '-'))
            throw new ArgumentException("Test root labels must be simple directory names.", nameof(label));
        var root = Path.Combine(ProcessRoot, label, Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        return root;
    }

    public static void AssertFallbackIsActive()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("TINADEC_HOME"), Home, PathComparison))
            throw new InvalidOperationException("The API test process TINADEC_HOME fallback was changed. Do not mutate it per test.");
        if (!string.Equals(ValidateTemporaryPath(Home), Home, PathComparison))
            throw new InvalidOperationException("The API test process home was replaced by a filesystem link.");
    }

    public static string RequireManagedRoot(string? root)
    {
        if (string.IsNullOrWhiteSpace(root))
            throw new InvalidOperationException("Managed API test hosts require an explicit temporary UserRoot before Program starts.");
        var full = ValidateTemporaryPath(root);
        if (!IsInside(ProcessRoot, full))
            throw new InvalidOperationException("Managed API test UserRoot must belong to this test process.");
        return full;
    }

    public static string ValidateTemporaryPath(string path)
    {
        if (!Path.IsPathFullyQualified(path))
            throw new InvalidOperationException("API test storage paths must be explicit absolute temporary paths.");
        var full = WorkspacePathSpelling.Canonical(path);
        if (!IsInside(TemporaryParent, full) || OriginalUserRoots.Any(root => IsInsideOrEqual(root, full) || IsInsideOrEqual(full, root)))
            throw new InvalidOperationException("An API test storage path is outside temporary storage or overlaps a real user root.");
        StorageScopePaths.RejectLinks(TemporaryParent, full);
        return full;
    }

    /// <summary>Read-only hashes, never configuration text or credentials.</summary>
    public static IReadOnlyDictionary<string, string> ReadRealUserConfigurationHashes()
    {
        var hashes = new SortedDictionary<string, string>(StringComparer.Ordinal);
        for (var index = 0; index < OriginalUserRoots.Length; index++)
        {
            var directory = Path.Combine(OriginalUserRoots[index], "config");
            if (!Directory.Exists(directory)) continue;
            var files = Directory.EnumerateFiles(directory, "*", new EnumerationOptions
            { RecurseSubdirectories = true, AttributesToSkip = FileAttributes.ReparsePoint });
            foreach (var path in files)
            {
                using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                hashes[$"{index}/{Path.GetRelativePath(directory, path)}"] = Convert.ToHexString(SHA256.HashData(stream));
            }
        }
        return hashes;
    }

    private static bool IsInside(string parent, string path) =>
        path.StartsWith(Path.TrimEndingDirectorySeparator(parent) + Path.DirectorySeparatorChar, PathComparison);
    private static bool IsInsideOrEqual(string parent, string path) =>
        string.Equals(Path.TrimEndingDirectorySeparator(parent), Path.TrimEndingDirectorySeparator(path), PathComparison) || IsInside(parent, path);
}
