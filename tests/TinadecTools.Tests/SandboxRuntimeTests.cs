using System.Diagnostics;
using TinadecTools.Runtime.Sandbox;
using TinadecTools.Tools.FileRW;

namespace TinadecTools.Tests;

public sealed class SandboxRuntimeTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(1_800_001)]
    public void ValidateTimeout_RejectsValuesOutsideConfiguredRange(int timeoutMs)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => CommandSandboxRuntime.ValidateTimeout(timeoutMs));
    }

    [Fact]
    public void BuildPermissions_AlwaysIncludesWorkspaceWriteAccess()
    {
        var permissions = CommandSandboxRuntime.BuildPermissions(null, null, null);

        Assert.Contains(WorkspacePathResolver.WorkspaceRoot, permissions.ReadPaths, StringComparer.OrdinalIgnoreCase);
        Assert.Contains(WorkspacePathResolver.WorkspaceRoot, permissions.WritePaths, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public void BuildPermissions_AllowsExplicitEnvironmentVariableNames()
    {
        var permissions = CommandSandboxRuntime.BuildPermissions(null, null, ["MY_PACKAGE_TOKEN"]);

        Assert.Equal(["MY_PACKAGE_TOKEN"], permissions.EnvironmentVariableNames);
    }

    [Fact]
    public void MergeGrants_DeduplicatesUnderThePlatformsOwnCaseRules()
    {
        var existing = new SandboxPolicyFile
        {
            ReadPaths = [@"C:\\tools"],
            WritePaths = [@"C:\\cache"],
            EnvironmentVariables = ["TOKEN"]
        };
        var permissions = new SandboxPermissions
        {
            ReadPaths = [@"C:\\TOOLS"],
            WritePaths = [@"C:\\cache\\"],
            EnvironmentVariableNames = ["token"]
        };

        var merged = SandboxPolicyStore.MergeGrants(permissions, existing);

        // A trailing separator is never part of a path's identity, so that pair merges
        // everywhere. Case variants are two different directories on Linux and two spellings
        // of one directory on Windows — the dedupe has to follow the file system, not a habit.
        Assert.Single(merged.WritePaths);
        Assert.Equal(OperatingSystem.IsWindows() ? 1 : 2, merged.ReadPaths.Count);
        Assert.Equal(OperatingSystem.IsWindows() ? 1 : 2, merged.EnvironmentVariables.Count);
    }

    [Fact]
    public void EnsureNotBroadWriteTarget_RefusesTheHomeAndSystemDirectories()
    {
        var home = Path.TrimEndingDirectorySeparator(
            Path.GetFullPath(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)));
        Assert.Throws<UnauthorizedAccessException>(
            () => SandboxPaths.EnsureNotBroadWriteTarget(home));

        if (!OperatingSystem.IsWindows())
        {
            Assert.Throws<UnauthorizedAccessException>(() => SandboxPaths.EnsureNotBroadWriteTarget("/"));
            Assert.Throws<UnauthorizedAccessException>(() => SandboxPaths.EnsureNotBroadWriteTarget("/usr"));
        }

        // A real project directory must remain grantable, or this guard is just a refusal.
        SandboxPaths.EnsureNotBroadWriteTarget(WorkspacePathResolver.WorkspaceRoot);
    }

    [Fact]
    public void BuildPermissions_RejectsInvalidEnvironmentVariableNames()
    {
        Assert.Throws<ArgumentException>(() => CommandSandboxRuntime.BuildPermissions(null, null, ["BAD=NAME"]));
    }

    [Fact]
    public void ValidateRequest_RejectsWorkingDirectoryOutsideWorkspace()
    {
        var outside = Path.GetFullPath(Path.Combine(WorkspacePathResolver.WorkspaceRoot, ".."));

        Assert.Throws<UnauthorizedAccessException>(() => SandboxRequestValidator.Validate(
            "git", [], outside, 1));
    }

    [Fact]
    public void ValidateRequestAcceptsTimeoutBoundaries()
    {
        SandboxRequestValidator.Validate("git", ["value with spaces", "quote\"value", "semi;colon", "amp&value"], WorkspacePathResolver.WorkspaceRoot, 1);
        SandboxRequestValidator.Validate("git", [], WorkspacePathResolver.WorkspaceRoot, 1_800_000, new Dictionary<string, string> { ["SAFE_NAME"] = "safe" });
    }

    [Fact]
    public void ValidateRequest_RejectsRawTailAlongsideArgv()
    {
        if (!OperatingSystem.IsWindows()) return;

        // ProcessStartInfo cannot carry both, so whichever side dropped one would run a
        // different command than the one the human approved.
        Assert.Throws<ArgumentException>(() => SandboxRequestValidator.Validate(
            "cmd.exe", ["/c", "dir"], WorkspacePathResolver.WorkspaceRoot, 1,
            argumentString: "/d /s /c \"dir\""));
        Assert.Throws<ArgumentException>(() => SandboxRequestValidator.Validate(
            "cmd.exe", [], WorkspacePathResolver.WorkspaceRoot, 1, argumentString: string.Empty));
        Assert.Throws<ArgumentException>(() => SandboxRequestValidator.Validate(
            "cmd.exe", [], WorkspacePathResolver.WorkspaceRoot, 1, argumentString: "evil\0command"));

        // The accepted shape is exactly what the shell tool produces: empty argv, raw tail.
        SandboxRequestValidator.Validate("cmd.exe", [], WorkspacePathResolver.WorkspaceRoot, 1,
            argumentString: "/d /s /c \"dir\"");
    }

    [Fact]
    public void ApplyCommandLine_PicksOneTransport()
    {
        var argvOnly = new SandboxRunnerRequest { Arguments = ["-lc", "echo hi"] };
        var argvPsi = new ProcessStartInfo();
        argvOnly.ApplyCommandLine(argvPsi);
        Assert.Equal(["-lc", "echo hi"], argvPsi.ArgumentList);
        Assert.Equal(string.Empty, argvPsi.Arguments);

        var tailOnly = new SandboxRunnerRequest { ArgumentString = "/d /s /c \"echo \"hi\"\"" };
        var tailPsi = new ProcessStartInfo();
        tailOnly.ApplyCommandLine(tailPsi);
        Assert.Empty(tailPsi.ArgumentList);
        Assert.Equal("/d /s /c \"echo \"hi\"\"", tailPsi.Arguments);
    }
}
