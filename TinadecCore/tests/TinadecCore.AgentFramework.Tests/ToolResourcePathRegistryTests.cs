using System.Text.Json;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Tools;

namespace TinadecCore.AgentFramework.Tests;

/// <summary>
/// WS-8 pinning: the per-tool path extractor. Parameter names are the real
/// TinadecTools bindings — both file tools carry the target under the JSON
/// property "filepath" — and every unregistered or unusable shape falls back to
/// "no path" (level-only decision), never to a widened grant.
/// </summary>
public sealed class ToolResourcePathRegistryTests
{
    [Theory]
    [InlineData("read_file")]
    [InlineData("write_file")]
    public void FileTools_ExtractTheWorkspaceRelativeTarget(string toolId)
    {
        var path = ToolResourcePathRegistry.TryExtractRelativePath(
            toolId, """{"filepath":"src/app.cs"}""", @"C:\ws");
        Assert.Equal("src/app.cs", path);
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
    [InlineData("shell")]
    [InlineData("mcp_search")]
    [InlineData("mcp_invoke")]
    [InlineData("git_commit")]
    [InlineData("git_push")]
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
            "shell", """{"command":"ls"}""", null, mutating: true));
    }
}
