using System.Text.Json;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Tools;
using TinadecCore.Contracts.Dtos;

namespace TinadecCore.AgentFramework.Tests;

/// <summary>
/// WS-8 pinning: the per-tool path extractor. Parameter names are the real
/// TinadecTools bindings — file tools carry "filepath", the directory/search tools
/// "path", the process tools "cwd"/"working_directory", and every git tool
/// "repository_path" — and every unregistered or unusable shape falls back to
/// "no path" (level-only decision), never to a widened grant.
/// </summary>
public sealed class ToolResourcePathRegistryTests
{
    [Fact]
    public void MultiFolderClaimsQualifyPrimaryAndSecondaryPathsWithoutNameCollisions()
    {
        var root = Path.Combine(Path.GetTempPath(), "multi-claims");
        var primary = Path.Combine(root, "primary"); var second = Path.Combine(root, "second");
        var context = new ToolExecutionContextDto { WorkingDirectory = primary, PrimaryRootId = "first",
            WorkspaceRoots = [new ToolWorkspaceRootDto { Id = "first", Path = primary }, new ToolWorkspaceRootDto { Id = "second", Path = second }] };
        var inPrimary = ToolResourcePathRegistry.TryBuildResourceClaim("read_file", JsonSerializer.Serialize(new { filepath = "second/same.txt" }), primary, false, context)!;
        var inSecond = ToolResourcePathRegistry.TryBuildResourceClaim("read_file", JsonSerializer.Serialize(new { filepath = Path.Combine(second, "same.txt") }), primary, false, context)!;
        Assert.Equal("path://first/second/same.txt", inPrimary.Resource);
        Assert.Equal("path://second/same.txt", inSecond.Resource);
        Assert.True(ToolResourceAllowList.Evaluate(["read:first/second"], ToolResourcePathRegistry.TryReadResourceClaimPath(inPrimary), false).Allowed);
        Assert.False(ToolResourceAllowList.Evaluate(["read:first/second"], ToolResourcePathRegistry.TryReadResourceClaimPath(inSecond), false).Allowed);
        Assert.Equal("path://second/same.txt", ToolResourcePathRegistry.TryBuildResourceClaim("read_file", JsonSerializer.Serialize(new { filepath = "same.txt" }), second, false, context)!.Resource);
    }
    [Theory]
    [InlineData("ls", "path", false)]
    [InlineData("git_status", "repository_path", false)]
    [InlineData("git_worktree_create", "repository_path", true)]
    public void ManagedWorkspaceRootRetainsItsClaimAndPrefixBoundary(string tool, string parameter, bool mutating)
    {
        var workspace = Path.Combine(Path.GetTempPath(), "root-claim-workspace");
        foreach (var target in new[] { ".", "./", workspace })
        {
            var claim = ToolResourcePathRegistry.TryBuildResourceClaim(tool,
                JsonSerializer.Serialize(new Dictionary<string, string> { [parameter] = target }),
                workspace, mutating, new ToolExecutionContextDto())!;
            Assert.Equal("workspace-root://root", claim.Resource);
            var relative = ToolResourcePathRegistry.TryReadResourceClaimPath(claim);
            Assert.Equal(".", relative);
            Assert.True(ToolResourceAllowList.Evaluate([mutating ? "write:" : "read:"], relative, mutating).Allowed);
            Assert.False(ToolResourceAllowList.Evaluate([mutating ? "write:src" : "read:src"], relative, mutating).Allowed);
        }
    }

    [Fact]
    public void ManagedSharedPackagesRequireExactFrozenRootAndReadTool()
    {
        var testRoot = Path.Combine(Path.GetTempPath(), "tool-claim-test", Guid.NewGuid().ToString("N"));
        var workspace = Path.Combine(testRoot, "workspace");
        var package = Path.Combine(testRoot, "shared", "probe");
        Directory.CreateDirectory(workspace);
        Directory.CreateDirectory(package);
        try
        {
        var id = Guid.NewGuid();
        var context = new ToolExecutionContextDto { ReadRoots = [new ToolReadRootDto { ResourceId = id, Path = package }] };
        var path = Path.Combine(package, "references", "example.txt");
        var parameters = JsonSerializer.Serialize(new { filepath = path });
        var read = ToolResourcePathRegistry.TryBuildResourceClaim("read_file", parameters, workspace, false, context)!;
        Assert.StartsWith($"skill://{id:D}/", read.Resource);
        Assert.True(ToolResourcePathRegistry.IsAuthorizedSkillClaim(read, context.ReadRoots));
        Assert.False(ToolResourcePathRegistry.IsAuthorizedSkillClaim(read, []));
        var write = ToolResourcePathRegistry.TryBuildResourceClaim("write_file", parameters, workspace, true, context)!;
        Assert.StartsWith("denied-path://", write.Resource);
        var sibling = ToolResourcePathRegistry.TryBuildResourceClaim("read_file", JsonSerializer.Serialize(new { filepath = package + "-sibling/SKILL.md" }), workspace, false, context)!;
        Assert.StartsWith("denied-path://", sibling.Resource);
        var escape = new CapabilityClaim("resource.access", "read", $"skill://{id:D}/%2E%2E%2Fsecret.txt");
        Assert.False(ToolResourcePathRegistry.IsAuthorizedSkillClaim(escape, context.ReadRoots));
        }
        finally { Directory.Delete(testRoot, true); }
    }

    [Theory]
    [InlineData("read_file")]
    [InlineData("write_file")]
    [InlineData("delete_file")]
    public void FileTools_ExtractTheWorkspaceRelativeTarget(string toolId)
    {
        var path = ToolResourcePathRegistry.TryExtractRelativePath(
            toolId, """{"filepath":"src/app.cs"}""", @"C:\ws");
        Assert.Equal("src/app.cs", path);
    }

    [Theory]
    [InlineData("ls", "path")]
    [InlineData("stat", "path")]
    [InlineData("file_search", "path")]
    [InlineData("shell", "cwd")]
    [InlineData("command_run", "working_directory")]
    [InlineData("git_status", "repository_path")]
    [InlineData("git_commit", "repository_path")]
    [InlineData("git_push", "repository_path")]
    [InlineData("git_worktree_create", "repository_path")]
    public void EveryPathTargetingTool_ContributesItsTarget(string toolId, string parameter)
    {
        var path = ToolResourcePathRegistry.TryExtractRelativePath(
            toolId, $$"""{"{{parameter}}":"src/app.cs"}""", @"C:\ws");
        Assert.Equal("src/app.cs", path);
        Assert.True(ToolResourcePathRegistry.IsRegistered(toolId));
    }

    [Fact]
    public void GitAndProcessTools_WithoutTheirPathArgument_YieldNoPath()
    {
        // A git call with no repository_path, or a shell call with no cwd, has no
        // single target: the level-only decision applies (the tool process still
        // refuses anything outside its own root).
        Assert.Null(ToolResourcePathRegistry.TryExtractRelativePath("git_status", """{"max_files":10}""", @"C:\ws"));
        Assert.Null(ToolResourcePathRegistry.TryExtractRelativePath("shell", """{"command":"ls"}""", @"C:\ws"));
    }

    [Fact]
    public void WindowsSeparatorsAndDotSegments_AreNormalized()
    {
        var path = ToolResourcePathRegistry.TryExtractRelativePath(
            "write_file", """{"filepath":".\\src\\nested\\app.cs"}""", null);
        Assert.Equal("src/nested/app.cs", path);
    }

    [Fact]
    public void AbsolutePathInsideTheWorkspace_IsMadeRelative()
    {
        var root = Path.Combine(Path.GetTempPath(), "ws");
        var absolute = Path.Combine(root, "src", "app.cs");
        var parameters = $$"""{"filepath":{{JsonSerializer.Serialize(absolute)}}}""";
        Assert.Equal("src/app.cs", ToolResourcePathRegistry.TryExtractRelativePath("read_file", parameters, root));
    }

    [Fact]
    public void AbsolutePathOutsideTheWorkspace_YieldsNoPath()
    {
        var root = Path.Combine(Path.GetTempPath(), "ws");
        var outside = Path.Combine(Path.GetTempPath(), "other", "app.cs");
        var parameters = $$"""{"filepath":{{JsonSerializer.Serialize(outside)}}}""";
        Assert.Null(ToolResourcePathRegistry.TryExtractRelativePath("read_file", parameters, root));
    }

    [Theory]
    [InlineData("mcp_search")]
    [InlineData("mcp_invoke")]
    [InlineData("create_workspace")]
    [InlineData("some_future_tool")]
    public void ToolsWithoutASinglePath_YieldNoPath(string toolId)
    {
        Assert.False(ToolResourcePathRegistry.IsRegistered(toolId));
        Assert.Null(ToolResourcePathRegistry.TryExtractRelativePath(toolId, """{"filepath":"src/app.cs"}""", null));
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("[1,2]")]
    [InlineData("{}")]
    [InlineData("""{"filepath":42}""")]
    [InlineData("""{"content":"x"}""")]
    public void UnusableParameters_YieldNoPath(string parametersJson)
    {
        Assert.Null(ToolResourcePathRegistry.TryExtractRelativePath("write_file", parametersJson, null));
    }

    [Theory]
    [InlineData("../outside.txt")]
    [InlineData("src/../../outside.txt")]
    public void EscapingTargets_YieldNoPath(string raw)
    {
        Assert.Null(ToolResourcePathRegistry.NormalizeRelativePath(raw));
    }

    [Fact]
    public void ResourceClaimPath_IsReadFromThePathSchemeOnly()
    {
        Assert.Equal("src/app.cs", ToolResourcePathRegistry.TryReadResourceClaimPath(
            new CapabilityClaim("resource.access", "read", "path://src/app.cs")));
        Assert.Null(ToolResourcePathRegistry.TryReadResourceClaimPath(null));
        Assert.Null(ToolResourcePathRegistry.TryReadResourceClaimPath(
            new CapabilityClaim("tool.invoke", "read", "tool://read_file")));
    }

    [Fact]
    public void ResourceClaim_MirrorsTheToolMutationClass()
    {
        var reading = ToolResourcePathRegistry.TryBuildResourceClaim(
            "read_file", """{"filepath":"src/app.cs"}""", null, mutating: false);
        Assert.NotNull(reading);
        Assert.Equal("resource.access", reading!.Capability);
        Assert.Equal("read", reading.Action);
        Assert.Equal("path://src/app.cs", reading.Resource);

        var mutating = ToolResourcePathRegistry.TryBuildResourceClaim(
            "write_file", """{"filepath":"src/app.cs"}""", null, mutating: true);
        Assert.NotNull(mutating);
        Assert.Equal("mutate", mutating!.Action);

        // A tool without a single path carries no resource dimension at all.
        Assert.Null(ToolResourcePathRegistry.TryBuildResourceClaim(
            "mcp_search", """{"query":"x"}""", null, mutating: true));
        // A process tool carries the directory it was pointed at.
        Assert.Equal("path://src", ToolResourcePathRegistry.TryBuildResourceClaim(
            "command_run", """{"working_directory":"src"}""", null, mutating: true)!.Resource);
    }
}
