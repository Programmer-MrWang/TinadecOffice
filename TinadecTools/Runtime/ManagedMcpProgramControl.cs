using System.Text.Json;
using System.Text.RegularExpressions;
using TinadecTools.Abstractions;
using TinadecTools.Runtime.Sandbox;
using TinadecTools.Tools.FileRW;

namespace TinadecTools.Runtime;

/// <summary>Reserved installer transport. Only Core's approved program action can reach this control.</summary>
internal static class ManagedMcpProgramControl
{
    internal const string Id = "#managed_mcp_program";
    internal static void Register() => ToolRegistry.Register(Id, InstallAsync, requiresApproval: true, mutatesWorkspace: true, retrySafety: "unsafe");

    private static async ValueTask<ToolCallResponse<JsonElement>> InstallAsync(ToolCallRequest<JsonElement> request, CancellationToken ct)
    {
        if (!request.Approved || ToolExecutionContext.Current is not { StorageRoot: { } root, StorageId: { Length: > 0 } })
            throw new UnauthorizedAccessException("Managed program installation requires an approved trusted storage context.");
        var data = request.Params;
        var manager = data.GetProperty("manager").GetString()!;
        var package = data.GetProperty("package").GetString()!;
        var version = data.GetProperty("version").GetString()!;
        var hash = data.GetProperty("plan_hash").GetString()!;
        var target = Path.GetFullPath(data.GetProperty("package_root").GetString()!);
        var packageBase = Path.Combine(root, "packages", "mcp");
        var relative = Path.GetRelativePath(packageBase, target).Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (!WorkspaceRootSet.IsWithin(packageBase, target) || relative.Length != 2 || !Guid.TryParseExact(relative[0], "N", out _)
            || hash.Length != 64 || hash.Any(c => !char.IsAsciiHexDigit(c)) || !(relative[1] == hash
                || relative[1].StartsWith(hash + "-", StringComparison.Ordinal) && Guid.TryParseExact(relative[1][65..], "N", out _)))
            throw new UnauthorizedAccessException("Managed program installation cannot leave its owned package directory.");
        if (manager is not ("npm" or "uv") || !Regex.IsMatch(package,
            manager == "npm" ? @"\A(?:@[a-z0-9._-]+/)?[a-z0-9][a-z0-9._-]*\z" : @"\A[a-zA-Z0-9][a-zA-Z0-9._-]*\z", RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1))
            || !Regex.IsMatch(version, manager == "npm" ? @"\A[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?\z" : @"\A[0-9][a-zA-Z0-9.!+_-]*\z", RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1)))
            throw new InvalidOperationException("Managed programs require a pinned package name and version.");
        AssertNoLinks(root, target);
        if (Directory.Exists(target)) throw new InvalidOperationException("The program destination already exists without a completed installation manifest; inspect or collect the incomplete package first.");
        var serverArguments = data.GetProperty("server_arguments").EnumerateArray().Select(x => x.GetString()
            ?? throw new InvalidOperationException("server_arguments must contain strings.")).ToArray();
        var node = manager == "npm" ? FindExecutable("node") : null;
        var executable = manager == "npm" ? node! : FindExecutable("uv");
        var npm = manager == "npm" ? FindNpmCli(node!) : null;
        var args = manager == "npm" ? new List<string> { npm!, "install", "--prefix", target, "--no-save", "--package-lock=false", "--ignore-scripts", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org", package + "@" + version }
            : new List<string> { "tool", "install", "--no-config", "--no-progress", "--only-binary=:all:", "--no-python-downloads", "--link-mode=copy", "--default-index=https://pypi.org/simple", package + "==" + version };
        Directory.CreateDirectory(target);
        try
        {
            var permissions = new SandboxPermissions { StorageId = ToolExecutionContext.Current!.StorageId, StorageRoot = root,
                ReadPaths = [WorkspacePathResolver.WorkspaceRoot, Path.GetDirectoryName(executable)!, .. (npm is null ? Array.Empty<string>() : new[] { Path.GetDirectoryName(npm)! })],
                ReadExceptions = [Path.GetDirectoryName(executable)!, .. (npm is null ? Array.Empty<string>() : new[] { Path.GetDirectoryName(npm)! })],
                WritePaths = [target], ProtectedPaths = WorkspaceStoragePolicy.ProtectedPaths(WorkspacePathResolver.WorkspaceRoot).ToList(),
                EnvironmentOverrides = manager == "uv" ? new() { ["UV_TOOL_DIR"] = Path.Combine(target, "tools"), ["UV_TOOL_BIN_DIR"] = Path.Combine(target, "bin") }
                    : new() { ["NPM_CONFIG_USERCONFIG"] = Path.Combine(target, ".npmrc") } };
            if (manager == "npm") await File.WriteAllTextAsync(Path.Combine(target, ".npmrc"), "", ct);
            var backend = CommandSandboxRuntime.GetBackend();
            await backend.EnsureSetupAsync(ct);
            var result = await backend.ExecuteAsync(new SandboxRunnerRequest { Executable = executable, Arguments = args,
                WorkingDirectory = WorkspacePathResolver.WorkspaceRoot, TimeoutMs = 600_000 }, permissions, false, ct);
            if (!result.Success) throw new InvalidOperationException(result.Error ?? $"The {manager} installer failed with exit code {result.ExitCode}: {result.Stderr}");
            string launchCommand; IReadOnlyList<string> launchArguments;
            if (manager == "npm")
            {
                var module = Path.Combine(target, "node_modules", package.Replace('/', Path.DirectorySeparatorChar));
                using var packageJson = JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(module, "package.json"), ct));
                var bin = packageJson.RootElement.GetProperty("bin");
                var binPath = bin.ValueKind == JsonValueKind.String ? bin.GetString()! : bin.TryGetProperty(package.Split('/').Last(), out var named)
                    ? named.GetString()! : bin.EnumerateObject().Count() == 1 ? bin.EnumerateObject().First().Value.GetString()! : throw new InvalidOperationException("The package has several executables; register an unambiguous package launcher.");
                var entry = Path.GetFullPath(binPath, module);
                if (!WorkspaceRootSet.IsWithin(target, entry) || !File.Exists(entry)) throw new InvalidOperationException("The installed executable leaves its package or is missing.");
                AssertNoLinks(target, entry);
                launchCommand = node!; launchArguments = new[] { entry }.Concat(serverArguments).ToArray();
            }
            else
            {
                CopyOwnedPythonLaunchers(target);
                var bin = Path.Combine(target, "bin");
                var candidate = Path.Combine(bin, package + (OperatingSystem.IsWindows() ? ".exe" : ""));
                if (!File.Exists(candidate))
                {
                    var entries = Directory.GetFiles(bin).Where(path => !path.EndsWith(".cmd", StringComparison.OrdinalIgnoreCase)).ToArray();
                    candidate = entries.Length == 1 ? entries[0] : throw new InvalidOperationException("The installed Python tool has several executables; register an unambiguous launcher.");
                }
                var resolved = new FileInfo(candidate).ResolveLinkTarget(true)?.FullName ?? candidate;
                if (!WorkspaceRootSet.IsWithin(target, resolved)) throw new InvalidOperationException("The installed Python executable leaves its package.");
                launchCommand = candidate; launchArguments = serverArguments;
            }
            MaterializeInternalProgramLinks(target);
            return ToolHostControls.Response(request.ToolCallId, writer =>
            {
                writer.WriteStartObject(); writer.WriteBoolean("success", true);
                writer.WriteString("launch_command", launchCommand); writer.WriteString("package_root", target);
                writer.WriteStartArray("launch_arguments"); foreach (var arg in launchArguments) writer.WriteStringValue(arg);
                writer.WriteEndArray(); writer.WriteEndObject();
            });
        }
        catch
        {
            if (Directory.Exists(target) && WorkspaceRootSet.IsWithin(packageBase, target)) Directory.Delete(target, true);
            throw;
        }
    }

    private static string FindExecutable(string name)
    {
        var fileName = name + (OperatingSystem.IsWindows() ? ".exe" : "");
        foreach (var directory in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            if (string.IsNullOrWhiteSpace(directory)) continue;
            var path = Path.Combine(directory, fileName);
            if (File.Exists(path)) return path;
        }
        throw new InvalidOperationException($"Managed MCP installation requires {name} on the host PATH; no program was installed.");
    }
    private static void CopyOwnedPythonLaunchers(string root)
    {
        var pending = new Stack<string>(); pending.Push(root);
        while (pending.TryPop(out var directory))
            foreach (var entry in Directory.EnumerateFileSystemEntries(directory))
            {
                var attributes = File.GetAttributes(entry);
                if ((attributes & FileAttributes.Directory) != 0)
                {
                    if ((attributes & FileAttributes.ReparsePoint) == 0) pending.Push(entry);
                    else if (!WorkspaceRootSet.IsWithin(root, new DirectoryInfo(entry).ResolveLinkTarget(true)!.FullName))
                        throw new InvalidOperationException("The installed Python package contains an external directory link.");
                    continue;
                }
                if ((attributes & FileAttributes.ReparsePoint) == 0) continue;
                var resolved = new FileInfo(entry).ResolveLinkTarget(true)?.FullName ?? throw new InvalidOperationException("The installed program has a broken link.");
                if (WorkspaceRootSet.IsWithin(root, resolved)) continue;
                var name = Path.GetFileName(entry);
                if (!name.StartsWith("python", StringComparison.Ordinal) && !name.StartsWith("pypy", StringComparison.Ordinal))
                    throw new InvalidOperationException("The installed Python package contains an external file link.");
                File.Delete(entry); File.Copy(resolved, entry);
                if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(entry, File.GetUnixFileMode(resolved));
            }
    }
    private static void MaterializeInternalProgramLinks(string root)
    {
        var pending = new Stack<string>(); pending.Push(root);
        while (pending.TryPop(out var directory))
            foreach (var entry in Directory.EnumerateFileSystemEntries(directory))
            {
                var attributes = File.GetAttributes(entry);
                if ((attributes & FileAttributes.ReparsePoint) != 0)
                {
                    FileSystemInfo info = (attributes & FileAttributes.Directory) != 0 ? new DirectoryInfo(entry) : new FileInfo(entry);
                    var resolved = info.ResolveLinkTarget(true)?.FullName ?? throw new InvalidOperationException("The installed package contains a broken link.");
                    if (!WorkspaceRootSet.IsWithin(root, resolved) || WorkspaceRootSet.IsWithin(resolved, entry))
                        throw new InvalidOperationException("The installed package contains an external or cyclic link.");
                    if ((attributes & FileAttributes.Directory) != 0)
                    {
                        Directory.Delete(entry); CopyTree(resolved, entry); pending.Push(entry);
                    }
                    else
                    {
                        File.Delete(entry); File.Copy(resolved, entry);
                        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(entry, File.GetUnixFileMode(resolved));
                    }
                }
                else if ((attributes & FileAttributes.Directory) != 0) pending.Push(entry);
            }
        static void CopyTree(string source, string target)
        {
            Directory.CreateDirectory(target);
            foreach (var file in Directory.EnumerateFiles(source)) File.Copy(file, Path.Combine(target, Path.GetFileName(file)));
            foreach (var directory in Directory.EnumerateDirectories(source))
            {
                if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) throw new InvalidOperationException("The copied package directory contains another link.");
                CopyTree(directory, Path.Combine(target, Path.GetFileName(directory)));
            }
        }
    }

    private static string FindNpmCli(string node)
    {
        var alongside = Path.Combine(Path.GetDirectoryName(node)!, "node_modules", "npm", "bin", "npm-cli.js");
        if (File.Exists(alongside)) return alongside;
        foreach (var directory in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            var path = Path.Combine(directory, "npm");
            if (!File.Exists(path)) continue;
            var resolved = new FileInfo(path).ResolveLinkTarget(true)?.FullName;
            if (resolved is not null && resolved.EndsWith("npm-cli.js", StringComparison.Ordinal)) return resolved;
        }
        throw new InvalidOperationException("The npm CLI beside Node.js is unavailable; no program was installed.");
    }

    private static void AssertNoLinks(string root, string target)
    {
        var current = root;
        foreach (var segment in Path.GetRelativePath(root, target).Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar))
        {
            current = Path.Combine(current, segment);
            if (!File.Exists(current) && !Directory.Exists(current)) break;
            if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) throw new UnauthorizedAccessException("Managed program paths cannot traverse links.");
        }
    }
}
