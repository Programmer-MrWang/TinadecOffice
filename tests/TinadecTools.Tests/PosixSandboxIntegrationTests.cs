using TinadecTools.Runtime.Sandbox;
using TinadecTools.Runtime.Sandbox.Posix;
using TinadecTools.Tools.FileRW;

namespace TinadecTools.Tests;

/// <summary>
/// Real-kernel evidence for the POSIX command sandbox: every case here spawns an actual confined
/// child and asks the kernel what it allowed. <see cref="PosixSandboxTests"/> pins the shape of
/// the seatbelt profile, the launcher payload and the Landlock right set — all of which can be
/// green while the mechanism itself does nothing. These are the cases that fail if Landlock stops
/// denying, if sandbox-exec stops accepting the generated profile, or if termination stops
/// reaching the process group.
///
/// They only execute on Linux and macOS (posix-core CI); on Windows they return immediately, and
/// the Windows backend keeps its own real-process coverage.
/// </summary>
public sealed class PosixSandboxIntegrationTests : IDisposable
{
    private const string KeptVariable = "TINADEC_SANDBOX_IT_KEPT";
    private const string DroppedVariable = "TINADEC_SANDBOX_IT_DROPPED";
    private const string LauncherFailurePrefix = "tinadec-sandbox:";

    private static readonly Func<string?> DefaultLauncher = PosixSandboxBackend.LauncherExecutable;

    /// <summary>Write-granted directory: a temp subdir, which the backend grants anyway via TMPDIR.</summary>
    private readonly string _granted = Directory.CreateTempSubdirectory("tinadec-sbx-it-").FullName;

    /// <summary>
    /// The out-of-bounds target. It is deliberately NOT under the temp directory: the backend adds
    /// TMPDIR (and the sandbox cache under it) to every grant, so a temp path would be denied
    /// nothing. This directory sits beside the test binaries, where the runner user could write if
    /// the sandbox let it.
    /// </summary>
    private readonly string _outside = Path.Combine(AppContext.BaseDirectory, "sandbox-integration-outside-" + Guid.NewGuid().ToString("N"));

    public PosixSandboxIntegrationTests()
    {
        Directory.CreateDirectory(_outside);
        if (OperatingSystem.IsLinux())
        {
            // The launcher re-execs "this binary" in production. Under a test host that binary is
            // xunit's, which does not know the reserved argument, so point it at the TinadecTools
            // apphost that the project reference copies beside the test runner.
            PosixSandboxBackend.LauncherExecutable = static () => Path.Combine(AppContext.BaseDirectory, "TinadecTools");
        }
    }

    public void Dispose()
    {
        PosixSandboxBackend.LauncherExecutable = DefaultLauncher;
        Environment.SetEnvironmentVariable(KeptVariable, null);
        Environment.SetEnvironmentVariable(DroppedVariable, null);
        TryDelete(_granted);
        TryDelete(_outside);
    }

    [Fact]
    public void TheConfinementMechanismThisPlatformReliesOnIsPresent()
    {
        if (OperatingSystem.IsLinux())
        {
            // ABI 0 means landlock_create_ruleset is unavailable (kernel < 5.13, or the LSM is not
            // enabled), and the launcher then fails every command closed with exit 126. If this
            // goes red on a CI runner, the runner cannot verify Landlock at all — that is the
            // reading, not a flake.
            var abi = LandlockApi.QueryAbiVersion();
            Assert.True(abi >= 1, $"Landlock is unavailable on this runner (landlock ABI {abi}); the denial cases below prove nothing here.");
            return;
        }

        if (OperatingSystem.IsMacOS())
        {
            Assert.True(File.Exists("/usr/bin/sandbox-exec"), "/usr/bin/sandbox-exec is missing; the macOS backend has no launcher.");
            return;
        }

        // Windows: the WindowsSandboxBackend owns this surface.
    }

    [Fact]
    public async Task AWriteInsideTheGrantedDirectorySucceeds()
    {
        if (!OnPosix) return;

        var target = Path.Combine(_granted, "inside.txt");
        var response = await RunAsync($"echo started; printf written > '{target}'");

        // On macOS this doubles as "sandbox-exec accepted the generated profile": a profile it
        // cannot parse makes it exit non-zero without running anything, so the marker would be
        // missing and the file would not exist.
        Assert.True(response.Success, $"exit={response.ExitCode} stdout={response.Stdout} stderr={response.Stderr} error={response.Error}");
        Assert.Contains("started", response.Stdout);
        Assert.Equal("written", File.ReadAllText(target));
    }

    [Fact]
    public async Task AWriteOutsideEveryGrantedDirectoryIsDeniedByTheKernel()
    {
        if (!OnPosix) return;

        var target = Path.Combine(_outside, "denied.txt");

        // Control first: prove this location is writable by an unconstrained process, otherwise
        // "the file is not there afterwards" could mean the directory was missing rather than the
        // kernel refusing. The ubuntu leg failed exactly this way the first time it ran.
        File.WriteAllText(target, "unconstrained");
        Assert.Equal("unconstrained", File.ReadAllText(target));
        File.Delete(target);

        var response = await RunAsync($"echo started; printf denied > '{target}'");

        Assert.Contains("started", response.Stdout);
        Assert.False(File.Exists(target), "the sandbox let a command write outside its grants");
        Assert.False(response.Success, $"exit={response.ExitCode} stderr={response.Stderr}");
        // A launcher that could not install Landlock also produces no file — but it never runs the
        // command, so "started" would be missing too. Naming the prefix keeps the two readings apart.
        Assert.DoesNotContain(LauncherFailurePrefix, response.Stderr);
    }

    [Fact]
    public async Task TheChildSeesTheRetainedEnvironmentAndNothingElse()
    {
        if (!OnPosix) return;

        Environment.SetEnvironmentVariable(KeptVariable, "kept-value");
        Environment.SetEnvironmentVariable(DroppedVariable, "dropped-value");

        var response = await RunAsync($"printf '%s|%s\\n' \"${KeptVariable}\" \"${DroppedVariable}\"; env", [KeptVariable]);

        Assert.True(response.Success, $"exit={response.ExitCode} stderr={response.Stderr} error={response.Error}");
        Assert.Contains("kept-value", response.Stdout);
        // env(1) lists the whole environment, so the dropped value appearing anywhere is a leak.
        Assert.DoesNotContain("dropped-value", response.Stdout);
        Assert.Contains("PATH=", response.Stdout);
    }

    [Fact]
    public async Task TerminationReachesTheWholeProcessGroup()
    {
        if (!OperatingSystem.IsLinux()) return; // macOS has no setpgid hook; see the class note in AGENTS.md.

        var pidFile = Path.Combine(_granted, "grandchild.pid");
        var response = await RunAsync($"sleep 30 & echo $! > '{pidFile}'; wait", timeoutMs: 8_000);

        Assert.True(response.TimedOut, $"exit={response.ExitCode} stdout={response.Stdout} stderr={response.Stderr}");
        Assert.True(File.Exists(pidFile), $"the command never backgrounded its child; stdout={response.Stdout} stderr={response.Stderr}");
        Assert.True(int.TryParse(File.ReadAllText(pidFile).Trim(), out var grandchild), $"unparsable pid '{File.ReadAllText(pidFile)}'");

        // kill(pid, 0) == 0 while the process exists. The group signal has to reach this background
        // child, not just the shell the parent knows about.
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (DateTime.UtcNow < deadline && PosixSysCalls.Kill(grandchild, 0) == 0)
            await Task.Delay(100);

        Assert.NotEqual(0, PosixSysCalls.Kill(grandchild, 0));
    }

    private static bool OnPosix => OperatingSystem.IsLinux() || OperatingSystem.IsMacOS();

    private async Task<SandboxRunnerResponse> RunAsync(string script, string[]? extraEnvironmentNames = null, int timeoutMs = 30_000)
    {
        // Grants are built by hand rather than through CommandSandboxRuntime.BuildPermissions,
        // which would add the workspace root as a writable path and make the denial case meaningless.
        var permissions = new SandboxPermissions
        {
            ReadPaths = [_granted],
            WritePaths = [_granted],
            EnvironmentVariableNames = [.. extraEnvironmentNames ?? []]
        };

        return await CommandSandboxRuntime.ExecuteSandboxedAsync(
            "/bin/sh",
            ["-c", script],
            WorkspacePathResolver.WorkspaceRoot,
            stdin: null,
            timeoutMs,
            permissions,
            persistGrants: false,
            CancellationToken.None);
    }

    private static void TryDelete(string path)
    {
        try { Directory.Delete(path, recursive: true); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
}
