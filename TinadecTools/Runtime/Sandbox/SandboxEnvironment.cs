using System.Collections.Generic;

namespace TinadecTools.Runtime.Sandbox;

internal static class SandboxEnvironment
{
    private static readonly HashSet<string> RetainFromHost = new(
        OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal)
    {
        "PATH", "PATHEXT", "SystemRoot", "TEMP", "TMP",
        "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE",
        "OS", "ComSpec", "windir",
        "LANG", "LC_ALL", "LC_CTYPE",
        "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
    };

    /// <summary>
    /// POSIX additions, and they are not decoration: without <c>HOME</c> git cannot find its
    /// config and reports a template-directory error, <c>TMPDIR</c> is where every build
    /// system writes, and a terminal-less <c>TERM</c> makes curses/less/ssh behave oddly
    /// enough that the failure looks like a broken sandbox rather than a missing variable.
    /// </summary>
    private static readonly string[] PosixRetain =
    [
        "HOME", "USER", "LOGNAME", "SHELL", "TERM", "TZ", "TMPDIR",
        "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME",
    ];

    internal static Dictionary<string, string> Build(
        IReadOnlyDictionary<string, string>? sandboxAccountDirs,
        IEnumerable<string>? extraEnvVarNames)
    {
        var env = new Dictionary<string, string>(
            OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal);

        foreach (var name in RetainFromHost)
        {
            var value = Environment.GetEnvironmentVariable(name);
            if (!string.IsNullOrEmpty(value))
                env[name] = value;
        }

        if (!OperatingSystem.IsWindows())
        {
            foreach (var name in PosixRetain)
            {
                var value = Environment.GetEnvironmentVariable(name);
                if (!string.IsNullOrEmpty(value))
                    env[name] = value;
            }

            // Redirect the caches a build tool insists on writing, instead of granting write
            // access to the user's real home. This is the POSIX form of what the Windows
            // backend does by pointing the sandbox account at its own profile and cache dirs.
            var scratch = SandboxCacheDirectory(env);
            foreach (var key in new[] { "NPM_CONFIG_CACHE", "PIP_CACHE_DIR", "CARGO_HOME", "XDG_CACHE_HOME", "XDG_CONFIG_HOME" })
                env[key] = Path.Combine(scratch, key == "PIP_CACHE_DIR" ? "pip" : key == "CARGO_HOME" ? "cargo" : key == "NPM_CONFIG_CACHE" ? "npm" : key.ToLowerInvariant());
        }

        if (sandboxAccountDirs is not null)
        {
            if (sandboxAccountDirs.TryGetValue("Profile", out var profile) && !string.IsNullOrEmpty(profile))
            {
                env["USERPROFILE"] = profile;
                env["APPDATA"] = Path.Combine(profile, "AppData", "Roaming");
                env["LOCALAPPDATA"] = Path.Combine(profile, "AppData", "Local");
                env["TEMP"] = Path.Combine(profile, "AppData", "Local", "Temp");
                env["TMP"] = Path.Combine(profile, "AppData", "Local", "Temp");
            }

            if (sandboxAccountDirs.TryGetValue("Cache", out var cache) && !string.IsNullOrEmpty(cache))
            {
                env["NPM_CONFIG_CACHE"] = Path.Combine(cache, "npm");
                env["NUGET_PACKAGES"] = Path.Combine(cache, "nuget");
                env["PIP_CACHE_DIR"] = Path.Combine(cache, "pip");
                env["CARGO_HOME"] = Path.Combine(cache, "cargo");
            }
        }

        if (extraEnvVarNames is not null)
        {
            foreach (var name in extraEnvVarNames)
            {
                ArgumentException.ThrowIfNullOrWhiteSpace(name);
                var value = Environment.GetEnvironmentVariable(name);
                if (value is not null)
                    env[name] = value;
            }
        }

        if (ToolExecutionContext.Current?.StorageRoot is { } storageRoot)
        {
            var identity = ScopeIdentity();
            var cache = Path.Combine(storageRoot, "cache", "sandbox", identity);
            var temporary = Path.Combine(storageRoot, "temp", "sandbox", identity);
            Directory.CreateDirectory(cache);
            Directory.CreateDirectory(temporary);
            env["NPM_CONFIG_CACHE"] = Path.Combine(cache, "npm");
            env["UV_CACHE_DIR"] = Path.Combine(cache, "uv");
            env["PIP_CACHE_DIR"] = Path.Combine(cache, "pip");
            env["NUGET_PACKAGES"] = Path.Combine(cache, "nuget");
            env["CARGO_HOME"] = Path.Combine(cache, "cargo");
            env["XDG_CACHE_HOME"] = cache;
            env["XDG_CONFIG_HOME"] = Path.Combine(cache, "config");
            env["TMPDIR"] = env["TEMP"] = env["TMP"] = temporary;
        }

        env.Remove("TINADEC_HOST_CONTROL_TOKEN");
        return env;
    }

    internal static bool IsEnvironmentVariableNameValid(string name)
    {
        return !string.IsNullOrWhiteSpace(name)
            && name.IndexOf('=') < 0
            && name.IndexOf('\0') < 0
            && !name.Any(char.IsWhiteSpace);
    }

    /// <summary>
    /// The one POSIX scratch root a confined command may write outside the workspace, and
    /// therefore the one path <c>PosixSandboxBackend</c> must add to its write grants. Cache
    /// variables point here rather than at the user's real home.
    /// </summary>
    internal static string SandboxCacheDirectory(IReadOnlyDictionary<string, string> environment)
    {
        if (ToolExecutionContext.Current?.StorageRoot is { } storageRoot)
        {
            var scoped = Path.Combine(storageRoot, "cache", "sandbox", ScopeIdentity());
            Directory.CreateDirectory(scoped);
            return scoped;
        }
        var root = environment.TryGetValue("TMPDIR", out var tmpDir) && !string.IsNullOrWhiteSpace(tmpDir)
            ? tmpDir
            : Path.GetTempPath();
        var directory = Path.Combine(root, "tinadec-sandbox-cache");
        Directory.CreateDirectory(directory);
        return directory;
    }

    internal static string ScopeIdentity() => "TinaSbx_" + Convert.ToHexStringLower(
        System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(
            (ToolExecutionContext.Current?.StorageId ?? "standalone:" + Environment.CurrentDirectory)
            + ":" + (ToolExecutionContext.Current?.ProjectStorageWrite == true))))[..12];
}
