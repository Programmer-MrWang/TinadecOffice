using System.Text.Json;
using TinadecTools.Abstractions;
using TinadecTools.Runtime;
using TinadecTools.Runtime.Sandbox;
using TinadecTools.Runtime.Sandbox.Windows;
using TinadecTools.Tools.FileRW;

namespace TinadecTools.Tests;

[Collection("CommandSandbox")]
public sealed class MultiFolderToolTests
{
    public MultiFolderToolTests() { GeneratedToolRegistry.RegisterAll(); ToolHostControls.Register(); }
    [Fact]
    public void WindowsRunnerRetainsHostFolderSetAndRejectsUnlistedWorkingDirectories()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var primary = new WorkspaceTestDirectory();
        var secondary = Path.Combine(Path.GetTempPath(), "tinadec-runner-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(secondary);
        try
        {
            using var authorization = WindowsSandboxRunner.EnterSpawnAuthorization([
                WindowsSandboxRunner.RunnerModeArg, "--workspace-root", WorkspacePathResolver.WorkspaceRoot,
                "--workspace-root", secondary]);
            Assert.Equal(secondary, SandboxPaths.ValidateWorkingDirectory(secondary));
            Assert.Throws<UnauthorizedAccessException>(() => SandboxPaths.ValidateWorkingDirectory(Path.GetTempPath()));
            Assert.Throws<InvalidDataException>(() => WindowsSandboxRunner.EnterSpawnAuthorization([
                WindowsSandboxRunner.RunnerModeArg, "--workspace-root", secondary]));
            Assert.NotEqual(SandboxAccountManager.IdentityFor("scope", false, "a"), SandboxAccountManager.IdentityFor("scope", false, "a\nb"));
            Assert.Equal(primary.Path, DpapiCredentialStore.ResolveUserRoot(primary.Path));
            Assert.Throws<InvalidOperationException>(() => DpapiCredentialStore.ResolveUserRoot("relative"));
        }
        finally { Directory.Delete(secondary, true); }
    }
    [Fact]
    public void WindowsCommandAndGitUseAnAuthorizedSecondaryFolder()
    {
        if (!OperatingSystem.IsWindows()) return;
        using var primary = new WorkspaceTestDirectory();
        var secondary = Path.Combine(Path.GetTempPath(), "tinadec-runner-command-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(secondary);
        try
        {
            using var authorization = WindowsSandboxRunner.EnterSpawnAuthorization([
                WindowsSandboxRunner.RunnerModeArg, "--workspace-root", WorkspacePathResolver.WorkspaceRoot,
                "--workspace-root", secondary]);
            var environment = new Dictionary<string, string> {
                ["SystemRoot"] = Environment.GetEnvironmentVariable("SystemRoot") ?? @"C:\Windows",
                ["PATH"] = Environment.GetEnvironmentVariable("PATH") ?? string.Empty,
                ["TEMP"] = Path.GetTempPath(), ["TMP"] = Path.GetTempPath()
            };
            // Exercises the production spawn/validation path as the current test user.
            // Low-privilege-account ACL enforcement has a separate platform acceptance.
            var command = WindowsSandboxRunner.RunSandboxedProcess(new() {
                Executable = "cmd.exe", Arguments = [], ArgumentString = "/d /s /c \"cd\"",
                WorkingDirectory = secondary, TimeoutMs = 30_000, Environment = environment
            });
            Assert.True(command.Success, command.Stderr); Assert.Equal(secondary, command.Stdout.Trim(), ignoreCase: true);
            var git = WindowsSandboxRunner.RunSandboxedProcess(new() {
                Executable = "git.exe", Arguments = ["init", "--quiet"], WorkingDirectory = secondary,
                TimeoutMs = 30_000, Environment = environment
            });
            Assert.True(git.Success, git.Stderr); Assert.True(Directory.Exists(Path.Combine(secondary, ".git")));
            Assert.False(Directory.Exists(Path.Combine(primary.Path, ".git")));
        }
        finally { Directory.Delete(secondary, true); }
    }
    [Fact]
    public async Task FrozenEnvelopeAllowsBothSourcesAndRejectsOutsideAndProtectedStorage()
    {
        using var primary = new WorkspaceTestDirectory();
        var secondary = Path.Combine(Path.GetTempPath(), "tinadec-secondary-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(secondary);
        try
        {
            var storage = Path.Combine(primary.Path, ".tinadec");
            var context = JsonSerializer.SerializeToElement(new { schema_version = 1, storage_id = "a", storage_root = storage,
                workspace_roots = new[] { new { id = "a", path = primary.Path }, new { id = "b", path = secondary } }, primary_root_id = "a",
                settings_hash = "frozen", settings = new { }, allowed_tool_ids = new[] { "write_file", "read_file" } });
            foreach (var path in new[] { Path.Combine(primary.Path, "same.txt"), Path.Combine(secondary, "same.txt") })
            {
                var response = await ToolRegistry.DispatchAsync(new() { ToolId = "write_file", ToolCallId = 8701, SessionId = "multi-root", Approved = true, ExecutionContext = context, Params = JsonSerializer.SerializeToElement(new { filepath = path, content = path }) });
                Assert.True(response.Response.GetProperty("success").GetBoolean(), response.Response.ToString()); Assert.Equal(path, await File.ReadAllTextAsync(path));
            }
            using (ToolExecutionContext.Enter(context))
            {
                Assert.Equal(secondary, SandboxPaths.ValidateWorkingDirectory(secondary));
                var permissions = CommandSandboxRuntime.BuildPermissions(null, null, null);
                Assert.Contains(secondary, permissions.WritePaths); Assert.Contains(primary.Path, permissions.ReadPaths);
                Assert.Throws<UnauthorizedAccessException>(() => WorkspacePathResolver.ResolvePath(Path.Combine(Path.GetTempPath(), "outside.txt"), writable: true));
                Assert.Throws<UnauthorizedAccessException>(() => WorkspacePathResolver.ResolvePath(Path.Combine(storage, "data", "facts"), writable: true));
            }
            var narrow = JsonSerializer.SerializeToElement(new { schema_version = 1, storage_id = "a", storage_root = storage,
                workspace_roots = new[] { new { id = "a", path = primary.Path } }, primary_root_id = "a", settings = new { }, allowed_tool_ids = new[] { "read_file" } });
            var denied = await ToolRegistry.DispatchAsync(new() { ToolId = "read_file", ToolCallId = 8702, SessionId = "other-run", ExecutionContext = narrow, Params = JsonSerializer.SerializeToElement(new { filepath = Path.Combine(secondary, "same.txt") }) });
            Assert.False(denied.Response.GetProperty("success").GetBoolean());
        }
        finally { Directory.Delete(secondary, true); }
    }
}
