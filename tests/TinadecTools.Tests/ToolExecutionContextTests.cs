using System.Text.Json;
using System.Net;
using TinadecTools.Abstractions;
using TinadecTools.Runtime;
using TinadecTools.Runtime.Sandbox;
using TinadecTools.Tools.Command;
using TinadecTools.Tools.FileRW;
using TinadecTools.Tools.Git;
using TinadecTools.Tools.Mcp;
using TinadecTools.Tools.Search;
using TinadecTools.Tools.Web;

namespace TinadecTools.Tests;

[Collection("CommandSandbox")]
public sealed class ToolExecutionContextTests
{
    public ToolExecutionContextTests()
    {
        GeneratedToolRegistry.RegisterAll();
        ShellToolRegistration.Register();
        ToolHostControls.Register();
    }

    private static JsonElement Json(string value) { using var document = JsonDocument.Parse(value); return document.RootElement.Clone(); }
    private static JsonElement Context(string settings, IEnumerable<string> tools, string roots = "[]", string servers = "[]", string? runId = null) =>
        Json("{\"schema_version\":1,\"agent_definition_id\":null,\"settings_hash\":\"test\",\"settings\":" + settings
             + ",\"allowed_tool_ids\":" + JsonSerializer.Serialize(tools) + ",\"read_roots\":" + roots + ",\"mcp_servers\":" + servers
             + (runId is null ? "" : ",\"run_id\":" + JsonSerializer.Serialize(runId)) + "}");
    private static ToolCallRequest<JsonElement> Request(string id, JsonElement parameters, JsonElement? context) => new()
    {
        ToolId = id, SessionId = "settings-test", ToolCallId = 90001, Approved = true,
        Params = parameters, ExecutionContext = context
    };

    [Fact]
    public async Task RealRead_DefaultLineLimitIsFrozenAndExplicitRangeWins()
    {
        using var workspace = new WorkspaceTestDirectory();
        var path = workspace.CreateFile("lines.txt", "a\nb\nc\nd\ne\n");
        var context = Context("{\"read\":{\"sentinel_line_limit\":2}}", ["read_file"]);
        var omitted = await ToolRegistry.DispatchAsync(Request("read_file", JsonSerializer.SerializeToElement(new { filepath = path }), context));
        Assert.Equal(2, omitted.Response.GetProperty("all_contents").GetArrayLength());
        var explicitRange = await ToolRegistry.DispatchAsync(Request("read_file", JsonSerializer.SerializeToElement(new { filepath = path, end_row = 4 }), context));
        Assert.Equal(4, explicitRange.Response.GetProperty("all_contents").GetArrayLength());
        var unlimited = await ToolRegistry.DispatchAsync(Request("read_file", JsonSerializer.SerializeToElement(new { filepath = path }),
            Context("{\"read\":{\"sentinel_line_limit\":0}}", ["read_file"])));
        Assert.Equal(5, unlimited.Response.GetProperty("all_contents").GetArrayLength());
        Assert.Null(ToolExecutionContext.Current);
    }

    [Fact]
    public async Task ConcurrentDispatchesKeepDifferentSettingsAndReadRoots()
    {
        var started = 0;
        var both = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        const string id = "test.settings-concurrent";
        ToolRegistry.Register(id, async (request, _) =>
        {
            if (Interlocked.Increment(ref started) == 2) both.TrySetResult();
            await both.Task.WaitAsync(TimeSpan.FromSeconds(5));
            await Task.Yield();
            var context = ToolExecutionContext.Current!;
            return new ToolCallResponse<JsonElement> { CallId = request.ToolCallId, IsSuccess = true,
                Response = JsonSerializer.SerializeToElement(new { count = context.Integer("read", "sentinel_line_limit", 150), roots = context.ReadRoots.ToArray() }) };
        }, requiresApproval: false, mutatesWorkspace: false);
        var rootA = Path.Combine(Path.GetTempPath(), "context-a");
        var rootB = Path.Combine(Path.GetTempPath(), "context-b");
        var a = ToolRegistry.DispatchAsync(Request(id, Json("{}"), Context("{\"read\":{\"sentinel_line_limit\":2}}", [id],
            JsonSerializer.Serialize(new[] { new { resource_id = "a", path = rootA } })))).AsTask();
        var b = ToolRegistry.DispatchAsync(Request(id, Json("{}"), Context("{\"read\":{\"sentinel_line_limit\":7}}", [id],
            JsonSerializer.Serialize(new[] { new { resource_id = "b", path = rootB } })))).AsTask();
        var results = await Task.WhenAll(a, b);
        Assert.Equal(2, results[0].Response.GetProperty("count").GetInt32());
        Assert.Equal(7, results[1].Response.GetProperty("count").GetInt32());
        Assert.Equal(rootA, results[0].Response.GetProperty("roots")[0].GetString());
        Assert.Equal(rootB, results[1].Response.GetProperty("roots")[0].GetString());
        Assert.Null(ToolExecutionContext.Current);
    }

    [Fact]
    public async Task FrozenSharedRootIsReadableOnlyToTheCallThatSelectedIt()
    {
        var root = Path.Combine(Path.GetTempPath(), "tinadec-context-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        var path = Path.Combine(root, "shared.txt");
        File.WriteAllText(path, "shared");
        try
        {
            var roots = JsonSerializer.Serialize(new[] { new { resource_id = "shared", path = root } });
            var selected = Context("{}", ["read_file", "write_file"], roots);
            var read = await ToolRegistry.DispatchAsync(Request("read_file", JsonSerializer.SerializeToElement(new { filepath = path }), selected));
            Assert.True(read.Response.GetProperty("success").GetBoolean());
            var denied = await ToolRegistry.DispatchAsync(Request("read_file", JsonSerializer.SerializeToElement(new { filepath = path }), Context("{}", ["read_file"])));
            Assert.False(denied.Response.GetProperty("success").GetBoolean());
            var write = await ToolRegistry.DispatchAsync(Request("write_file", JsonSerializer.SerializeToElement(new { filepath = path, content = "changed" }), selected));
            Assert.False(write.Response.GetProperty("success").GetBoolean());
            Assert.Equal("shared", File.ReadAllText(path));
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public void AdditionalWriteGrantCannotOverlapFrozenSkillReadRootOrItsParent()
    {
        var root = Path.Combine(Path.GetTempPath(), "tinadec-skill-root-" + Guid.NewGuid().ToString("N"));
        var skillRoot = Path.Combine(root, "package");
        Directory.CreateDirectory(skillRoot);
        try
        {
            var context = Context("{}", ["command_run"], JsonSerializer.Serialize(new[] { new { resource_id = "skill", path = skillRoot } }));
            using var scope = ToolExecutionContext.Enter(context, "command_run");
            Assert.Throws<UnauthorizedAccessException>(() => CommandSandboxRuntime.BuildPermissions(null, [skillRoot], null));
            Assert.Throws<UnauthorizedAccessException>(() => CommandSandboxRuntime.BuildPermissions(null, [root], null));
        }
        finally { Directory.Delete(root, true); }
    }

    [Fact]
    public void AdditionalWriteGrantCannotReachSkillThroughDirectoryLink()
    {
        var root = Path.Combine(Path.GetTempPath(), "tinadec-skill-link-" + Guid.NewGuid().ToString("N"));
        var skillRoot = Path.Combine(root, "package");
        var alias = Path.Combine(root, "alias");
        Directory.CreateDirectory(skillRoot);
        try
        {
            try { Directory.CreateSymbolicLink(alias, skillRoot); }
            catch (Exception) { return; }
            var context = Context("{}", ["command_run"], JsonSerializer.Serialize(new[] { new { resource_id = "skill", path = skillRoot } }));
            using var scope = ToolExecutionContext.Enter(context, "command_run");
            Assert.Throws<UnauthorizedAccessException>(() => CommandSandboxRuntime.BuildPermissions(null, [alias], null));
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }

    [Fact]
    public async Task DisabledCategoryAndToolAllowlistFailBeforeDispatch()
    {
        var request = Request("read_file", Json("{\"filepath\":\"missing\"}"), Context("{\"read\":{\"enabled\":false}}", ["read_file"]));
        await Assert.ThrowsAsync<InvalidOperationException>(() => ToolRegistry.DispatchAsync(request).AsTask());
        request.ExecutionContext = Context("{}", []);
        await Assert.ThrowsAsync<InvalidOperationException>(() => ToolRegistry.DispatchAsync(request).AsTask());
        Assert.Null(ToolExecutionContext.Current);
        using var workspace = new WorkspaceTestDirectory();
        var preserved = workspace.CreateFile("disabled-delete.txt", "preserve");
        var delete = Request("delete_file", JsonSerializer.SerializeToElement(new
            { filepath = preserved, file_hash = FileHashing.ComputeFileHash(File.ReadAllBytes(preserved)) }),
            Context("{\"write\":{\"enabled\":false}}", ["delete_file"]));
        await Assert.ThrowsAsync<InvalidOperationException>(() => ToolRegistry.DispatchAsync(delete).AsTask());
        Assert.Equal("preserve", File.ReadAllText(preserved));
        var alias = Request("insert_byte", Json("{}"), Context("{\"write\":{\"enabled\":false}}", ["insert_byte"]));
        await Assert.ThrowsAsync<InvalidOperationException>(() => ToolRegistry.DispatchAsync(alias).AsTask());
    }

    [Fact]
    public async Task BinaryWriteAndDeleteKeepApprovalHashesAndSharedRootBoundary()
    {
        using var workspace = new WorkspaceTestDirectory();
        var path = workspace.CreateFile("binary-target.bin", "original");
        var original = File.ReadAllBytes(path);
        var hash = FileHashing.ComputeFileHash(original);
        byte[] binary = [0, 1, 255, 13, 10];
        var context = Context("{\"write\":{\"max_file_bytes\":5}}", ["write_file", "delete_file"]);
        JsonElement Parameters(string anchor, byte[] data) => JsonSerializer.SerializeToElement(new
            { filepath = path, content_base64 = Convert.ToBase64String(data), file_hash = anchor });
        var missingApproval = Request("write_file", Parameters(hash, binary), context);
        missingApproval.Approved = false;
        Assert.False((await ToolRegistry.DispatchAsync(missingApproval)).IsSuccess);
        Assert.Equal(original, File.ReadAllBytes(path));
        var stale = await ToolRegistry.DispatchAsync(Request("write_file", Parameters("stale", binary), context));
        Assert.False(stale.Response.GetProperty("success").GetBoolean());
        Assert.Equal(original, File.ReadAllBytes(path));
        var tooLarge = await ToolRegistry.DispatchAsync(Request("write_file", Parameters(hash, [0, 1, 2, 3, 4, 5]), context));
        Assert.False(tooLarge.Response.GetProperty("success").GetBoolean());
        Assert.Equal(original, File.ReadAllBytes(path));
        var written = await ToolRegistry.DispatchAsync(Request("write_file", Parameters(hash, binary), context));
        Assert.True(written.Response.GetProperty("success").GetBoolean(), written.Response.GetRawText());
        Assert.Equal(binary, File.ReadAllBytes(path));
        var deleteParams = JsonSerializer.SerializeToElement(new { filepath = path, file_hash = written.Response.GetProperty("file_hash").GetString() });
        var deniedDelete = Request("delete_file", deleteParams, context);
        deniedDelete.Approved = false;
        Assert.False((await ToolRegistry.DispatchAsync(deniedDelete)).IsSuccess);
        Assert.Equal(binary, File.ReadAllBytes(path));
        var staleDelete = await ToolRegistry.DispatchAsync(Request("delete_file", JsonSerializer.SerializeToElement(new { filepath = path, file_hash = hash }), context));
        Assert.False(staleDelete.Response.GetProperty("success").GetBoolean());
        Assert.Equal(binary, File.ReadAllBytes(path));
        var deleted = await ToolRegistry.DispatchAsync(Request("delete_file", deleteParams, context));
        Assert.True(deleted.Response.GetProperty("success").GetBoolean());
        Assert.False(File.Exists(path));

        var sharedRoot = Path.Combine(Path.GetTempPath(), "tinadec-delete-shared-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(sharedRoot);
        try
        {
            var shared = Path.Combine(sharedRoot, "asset.bin");
            await File.WriteAllBytesAsync(shared, binary);
            var sharedContext = Context("{}", ["write_file", "delete_file"], JsonSerializer.Serialize(new[] { new { resource_id = "skill", path = sharedRoot } }));
            var forbiddenWrite = await ToolRegistry.DispatchAsync(Request("write_file", JsonSerializer.SerializeToElement(new
                { filepath = shared, content_base64 = Convert.ToBase64String(original), file_hash = FileHashing.ComputeFileHash(binary) }), sharedContext));
            var forbiddenDelete = await ToolRegistry.DispatchAsync(Request("delete_file", JsonSerializer.SerializeToElement(new
                { filepath = shared, file_hash = FileHashing.ComputeFileHash(binary) }), sharedContext));
            Assert.False(forbiddenWrite.Response.GetProperty("success").GetBoolean());
            Assert.False(forbiddenDelete.Response.GetProperty("success").GetBoolean());
            Assert.Equal(binary, File.ReadAllBytes(shared));
        }
        finally { Directory.Delete(sharedRoot, true); }
    }

    [Fact]
    public async Task RealDirectoryPagingUsesConfiguredDefaultAndExplicitLimitWins()
    {
        using var workspace = new WorkspaceTestDirectory();
        for (var i = 0; i < 4; i++) workspace.CreateFile($"{i}.txt", "x");
        var context = Context("{\"read\":{\"directory_page_size\":2}}", ["ls"]);
        var result = await ToolRegistry.DispatchAsync(Request("ls", JsonSerializer.SerializeToElement(new { path = workspace.Path }), context));
        Assert.Equal(2, result.Response.GetProperty("entries").GetArrayLength());
        Assert.True(result.Response.GetProperty("has_more").GetBoolean());
        var explicitLimit = await ToolRegistry.DispatchAsync(Request("ls", JsonSerializer.SerializeToElement(new { path = workspace.Path, limit = 3 }), context));
        Assert.Equal(3, explicitLimit.Response.GetProperty("entries").GetArrayLength());
    }

    [Fact]
    public async Task RealSearchResolvesPresenceDefaultsAndHiddenIgnoreBehavior()
    {
        var rg = RipgrepRunner.ResolveRgPath();
        if (!File.Exists(rg)) return; // Optional dependency, matching the existing search suite.
        using var workspace = new WorkspaceTestDirectory();
        workspace.CreateFile(".hidden.txt", "needle\n");
        workspace.CreateFile("ignored.txt", "needle\n");
        workspace.CreateFile(".ignore", "ignored.txt\n");
        var settings = "{\"search\":{\"max_results\":1,\"include_hidden\":true,\"respect_ignore_files\":false}}";
        var context = Context(settings, ["file_search"]);
        var result = await ToolRegistry.DispatchAsync(Request("file_search", JsonSerializer.SerializeToElement(new { path = workspace.Path, pattern = "needle" }), context));
        Assert.True(result.Response.GetProperty("success").GetBoolean(), result.Response.GetRawText());
        Assert.Equal(1, result.Response.GetProperty("lines").GetArrayLength());
        Assert.True(result.Response.GetProperty("truncated").GetBoolean());
        var explicitArgs = await ToolRegistry.DispatchAsync(Request("file_search", JsonSerializer.SerializeToElement(new { path = workspace.Path,
            pattern = "needle", max_results = 10, include_hidden = false, respect_ignore_files = true }), context));
        Assert.True(explicitArgs.Response.GetProperty("success").GetBoolean(), explicitArgs.Response.GetRawText());
        Assert.Equal(0, explicitArgs.Response.GetProperty("lines").GetArrayLength());
    }

    [Fact]
    public async Task ReadRootsDoNotPermitLinkTraversalOutsideTheSelectedPackage()
    {
        var root = Path.Combine(Path.GetTempPath(), "tinadec-context-link-" + Guid.NewGuid().ToString("N"));
        var external = Path.Combine(Path.GetTempPath(), "tinadec-context-target-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        Directory.CreateDirectory(external);
        File.WriteAllText(Path.Combine(external, "private.txt"), "private");
        try
        {
            // Windows Developer Mode is required for a real symbolic link; the existing helper
            // records that prerequisite through the same convention as boundary tests.
            var link = Path.Combine(root, "linked");
            if (!LinkPrerequisite.TryCreateDirectoryLink(link, external)) return;
            var roots = JsonSerializer.Serialize(new[] { new { resource_id = "package", path = root } });
            var result = await ToolRegistry.DispatchAsync(Request("read_file", JsonSerializer.SerializeToElement(new { filepath = Path.Combine(link, "private.txt") }),
                Context("{}", ["read_file"], roots)));
            Assert.False(result.Response.GetProperty("success").GetBoolean());
            Assert.Contains("symbolic", result.Response.GetProperty("error").GetString(), StringComparison.OrdinalIgnoreCase);
        }
        finally { Directory.Delete(root, true); Directory.Delete(external, true); }
    }

    [Fact]
    public async Task ModelParamsCannotSupplyTrustedContext()
    {
        using var workspace = new WorkspaceTestDirectory();
        var path = workspace.CreateFile("params.txt", "a\nb\nc\n");
        var parameters = JsonSerializer.SerializeToElement(new { filepath = path,
            execution_context = new { settings = new { read = new { sentinel_line_limit = 1 } } } });
        var result = await ToolRegistry.DispatchAsync(Request("read_file", parameters, null));
        Assert.Equal(3, result.Response.GetProperty("all_contents").GetArrayLength());
    }

    [Fact]
    public void RawDefaultsPreserveExplicitFalseAndExplicitNumbers()
    {
        using var scope = ToolExecutionContext.Enter(Context("{\"search\":{\"max_results\":7,\"case_sensitive\":true},\"web\":{\"timeout_ms\":1234}}", ["file_search", "web_fetch"]));
        var context = ToolExecutionContext.Current!;
        var search = context.ApplyDefaults("file_search", Json("{\"pattern\":\"a\",\"case_sensitive\":false,\"max_results\":2}"));
        Assert.False(search.GetProperty("case_sensitive").GetBoolean());
        Assert.Equal(2, search.GetProperty("max_results").GetInt32());
        var defaults = context.ApplyDefaults("file_search", Json("{\"pattern\":\"a\"}"));
        Assert.Equal(7, defaults.GetProperty("max_results").GetInt32());
        Assert.True(defaults.GetProperty("case_sensitive").GetBoolean());
        Assert.Equal(1234, context.ApplyDefaults("web_fetch", Json("{\"url\":\"https://example.com\"}")).GetProperty("timeout_ms").GetInt32());
    }

    [Fact]
    public async Task FileSizeLimitsRejectBeforeWritingAndBeforeCreatingParents()
    {
        using var workspace = new WorkspaceTestDirectory();
        var path = workspace.CreateFile("large.txt", "long-content");
        var context = Context("{\"read\":{\"max_file_bytes\":3},\"write\":{\"max_file_bytes\":3,\"create_parent_directories\":false}}", ["read_file", "write_file"]);
        var read = await ToolRegistry.DispatchAsync(Request("read_file", JsonSerializer.SerializeToElement(new { filepath = path }), context));
        Assert.False(read.Response.GetProperty("success").GetBoolean());
        var target = Path.Combine(workspace.Path, "new-parent", "file.txt");
        var oversized = await ToolRegistry.DispatchAsync(Request("write_file", JsonSerializer.SerializeToElement(new { filepath = target, content = "too-long" }), context));
        Assert.False(oversized.Response.GetProperty("success").GetBoolean());
        var noParents = await ToolRegistry.DispatchAsync(Request("write_file", JsonSerializer.SerializeToElement(new { filepath = target, content = "ok" }), context));
        Assert.False(noParents.Response.GetProperty("success").GetBoolean());
        Assert.False(Directory.Exists(Path.GetDirectoryName(target)));
        Assert.Equal("long-content", File.ReadAllText(path));
    }

    [Fact]
    public async Task ShellUsesConfiguredDefaultDeadlineOutputBudgetAndExplicitTimeout()
    {
        var backend = new RecordingBackend();
        using var replacement = CommandSandboxRuntime.OverrideBackendForTests(backend);
        var context = Context("{\"shell\":{\"timeout_ms\":4321,\"max_timeout_ms\":5000,\"max_output_chars\":3}}", ["shell"]);
        var result = await ToolRegistry.DispatchAsync(Request("shell", Json("{\"command\":\"echo test\"}"), context));
        Assert.Equal(4321, backend.Request!.TimeoutMs);
        Assert.Equal("out", result.Response.GetProperty("stdout").GetString());
        Assert.True(result.Response.GetProperty("stdout_truncated").GetBoolean());
        await ToolRegistry.DispatchAsync(Request("shell", Json("{\"command\":\"echo test\",\"timeout_ms\":12}"), context));
        Assert.Equal(12, backend.Request!.TimeoutMs);
        await ToolRegistry.DispatchAsync(Request("shell", Json("{\"command\":\"echo test\",\"timeout_ms\":6000}"), context));
        Assert.Equal(5000, backend.Request!.TimeoutMs);
    }

    [Fact]
    public async Task ContextMcpResourcesDoNotFallBackToLegacyFileAndChangesUseNewConnections()
    {
        await using var pool = new McpClientPool();
        var fixture = Path.Combine(AppContext.BaseDirectory, "fixtures", "mcp-mock-server.js");
        string Servers(string prefix) => JsonSerializer.Serialize(new[] { new { resource_id = "shared:mock", id = "mock", name = "mock",
            command = "node", args = new[] { fixture }, env = new Dictionary<string, string> { ["TINADEC_MCP_ECHO_PREFIX"] = prefix } } });
        var repository = new McpServerRepository(Path.Combine(Path.GetTempPath(), "missing-mcp.json"));
        async Task<string> Invoke(string prefix)
        {
            using var scope = ToolExecutionContext.Enter(Context("{\"mcp\":{\"timeout_ms\":10000}}", ["mcp_invoke"], servers: Servers(prefix), runId: prefix));
            var config = Assert.Single(await repository.ListAsync());
            var result = await pool.InvokeAsync(config, "echo", Json("{\"message\":\"value\"}"));
            return result.GetRawText();
        }
        Assert.Contains("one:value", await Invoke("one"));
        Assert.Contains("two:value", await Invoke("two"));
        Assert.Contains("one:value", await Invoke("one")); // Old frozen calls still use the old client.
        Assert.Equal(2, pool.CachedClientCount);
        await pool.ReleaseRunAsync("two");
        Assert.Equal(1, pool.CachedClientCount);
        Assert.Contains("one:value", await Invoke("one"));
        await pool.ReleaseRunAsync("one");
        Assert.Equal(0, pool.CachedClientCount);
        using (ToolExecutionContext.Enter(Context("{}", ["mcp_list"]))) Assert.Empty(await repository.ListAsync());
    }

    [Fact]
    public async Task McpRunReleaseKeepsOtherLeasesAndActiveCallsUntilTheyFinish()
    {
        await using var pool = new McpClientPool();
        var server = new McpServerConfig { Id = "leases", Command = "node",
            Args = [Path.Combine(AppContext.BaseDirectory, "fixtures", "mcp-mock-server.js")] };
        async Task<JsonElement> Invoke(string runId, string parameters)
        {
            using var scope = ToolExecutionContext.Enter(Context("{\"mcp\":{\"timeout_ms\":10000}}", ["mcp_invoke"], runId: runId));
            return await pool.InvokeAsync(server, "echo", Json(parameters));
        }
        await Invoke("run-a", "{\"message\":\"warm\"}");
        await Invoke("run-b", "{\"message\":\"warm\"}");
        Assert.Equal(1, pool.CachedClientCount);
        await pool.ReleaseRunAsync("run-a");
        Assert.Equal(1, pool.CachedClientCount);
        await Assert.ThrowsAsync<InvalidOperationException>(() => Invoke("run-a", "{\"message\":\"late\"}"));
        var active = Invoke("run-b", "{\"message\":\"slow\",\"delay_ms\":500}");
        Assert.False(active.IsCompleted);
        await pool.ReleaseRunAsync("run-b");
        Assert.Equal(1, pool.CachedClientCount); // Last lease ended, but the in-flight call still owns it.
        Assert.Contains("echo:slow", (await active).GetRawText());
        Assert.Equal(0, pool.CachedClientCount);
    }

    [Fact]
    public async Task McpStandaloneCachingAndTransientContextCleanupArePreserved()
    {
        var server = new McpServerConfig { Id = "cache", Command = "node",
            Args = [Path.Combine(AppContext.BaseDirectory, "fixtures", "mcp-mock-server.js")] };
        await using var standalone = new McpClientPool();
        await standalone.InvokeAsync(server, "echo", Json("{\"message\":\"standalone\"}"));
        await standalone.ReleaseRunAsync("unrelated");
        Assert.Equal(1, standalone.CachedClientCount);
        await using var transient = new McpClientPool();
        using (ToolExecutionContext.Enter(Context("{}", ["mcp_invoke"])))
            await transient.InvokeAsync(server, "echo", Json("{\"message\":\"transient\"}"));
        Assert.Equal(0, transient.CachedClientCount);
    }

    [Fact]
    public async Task SharedMcpInitializationDoesNotInheritTheFirstCallersShortDeadline()
    {
        await using var pool = new McpClientPool();
        var server = new McpServerConfig { Id = "startup", Command = "node",
            Args = [Path.Combine(AppContext.BaseDirectory, "fixtures", "mcp-mock-server.js")],
            Env = new() { ["TINADEC_MCP_INIT_DELAY_MS"] = "150" } };
        async Task<JsonElement> Invoke(string runId, int timeout)
        {
            using var scope = ToolExecutionContext.Enter(Context($"{{\"mcp\":{{\"timeout_ms\":{timeout}}}}}", ["mcp_invoke"], runId: runId));
            return await pool.InvokeAsync(server, "echo", Json("{\"message\":\"value\"}"));
        }
        var shortCall = Invoke("short", 1);
        var longCall = Invoke("long", 10000);
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => shortCall);
        await pool.ReleaseRunAsync("short");
        Assert.Contains("echo:value", (await longCall).GetRawText());
        Assert.Equal(1, pool.CachedClientCount);
        await pool.ReleaseRunAsync("long");
        Assert.Equal(0, pool.CachedClientCount);
    }

    [Fact]
    public async Task ExactMcpResourcesWithTheSameFriendlyIdRemainIndependentlyInvokable()
    {
        await using var pool = new McpClientPool();
        McpRuntime.ConfigureForTests(clientPool: pool);
        var shared = Guid.NewGuid().ToString();
        var project = Guid.NewGuid().ToString();
        var fixture = Path.Combine(AppContext.BaseDirectory, "fixtures", "mcp-mock-server.js");
        var resources = JsonSerializer.Serialize(new[]
        {
            new { resource_id = shared, id = "mock", name = "Shared mock", command = "node", args = new[] { fixture }, env = new Dictionary<string, string> { ["TINADEC_MCP_ECHO_PREFIX"] = "shared" } },
            new { resource_id = project, id = "mock", name = "Project mock", command = "node", args = new[] { fixture }, env = new Dictionary<string, string> { ["TINADEC_MCP_ECHO_PREFIX"] = "project" } }
        });
        var context = Context("{\"mcp\":{\"timeout_ms\":10000}}", ["mcp_list", "mcp_search", "mcp_invoke"], servers: resources, runId: "exact-resources");
        var list = (await ToolRegistry.DispatchAsync(Request("mcp_list", Json("{}"), context))).Response.GetProperty("servers");
        Assert.Equal(2, list.GetArrayLength());
        Assert.Equal(shared, list[0].GetProperty("id").GetString());
        Assert.Equal(shared, list[0].GetProperty("resource_id").GetString());
        Assert.Equal(project, list[1].GetProperty("id").GetString());
        var search = (await ToolRegistry.DispatchAsync(Request("mcp_search", Json("{\"query\":\"echo\"}"), context))).Response.GetProperty("results");
        Assert.Equal(new[] { shared, project }.Order(), search.EnumerateArray().Select(item => item.GetProperty("server_id").GetString()).Order());
        foreach (var (id, prefix) in new[] { (shared, "shared"), (project, "project") })
        {
            var invoke = (await ToolRegistry.DispatchAsync(Request("mcp_invoke", JsonSerializer.SerializeToElement(new
                { server_id = id, tool_name = "echo", arguments = new { message = "value" } }), context))).Response;
            Assert.True(invoke.GetProperty("success").GetBoolean(), invoke.GetRawText());
            Assert.Contains(prefix + ":value", invoke.GetRawText());
        }
        var ambiguous = (await ToolRegistry.DispatchAsync(Request("mcp_invoke", Json("{\"server_id\":\"mock\",\"tool_name\":\"echo\"}"), context))).Response;
        Assert.False(ambiguous.GetProperty("success").GetBoolean());
        Assert.Contains("ambiguous", ambiguous.GetProperty("error").GetString());
        await pool.ReleaseRunAsync("exact-resources");
        Assert.Equal(0, pool.CachedClientCount);
    }

    [Fact]
    public async Task HostControlsAreApprovalFreeAndDoNotChangeTheModelManifest()
    {
        var manifest = await ToolRegistry.DispatchAsync(Request("#manifest", Json("{}"), null));
        Assert.DoesNotContain(ToolRegistry.ListTools(), descriptor => descriptor.Id == ToolHostControls.CapabilitiesId
            || descriptor.Id == ToolHostControls.ReleaseExecutionContextId);
        await using var pool = new McpClientPool();
        McpRuntime.ConfigureForTests(clientPool: pool);
        var server = new McpServerConfig { Id = "release", Command = "node",
            Args = [Path.Combine(AppContext.BaseDirectory, "fixtures", "mcp-mock-server.js")] };
        using (ToolExecutionContext.Enter(Context("{}", ["mcp_invoke"], runId: "control-run")))
            await pool.InvokeAsync(server, "echo", Json("{\"message\":\"warm\"}"));
        var request = Request(ToolHostControls.ReleaseExecutionContextId, Json("{\"run_id\":\"control-run\"}"), null);
        request.Approved = false;
        var release = await ToolRegistry.DispatchAsync(request);
        Assert.True(release.Response.GetProperty("released").GetBoolean());
        Assert.Equal(0, pool.CachedClientCount);
        var after = await ToolRegistry.DispatchAsync(Request("#manifest", Json("{}"), null));
        Assert.Equal(manifest.Response.GetProperty("manifest_hash").GetString(), after.Response.GetProperty("manifest_hash").GetString());
    }

    [Fact]
    public async Task CapabilitiesInspectConfiguredDependenciesWithoutRunningCommands()
    {
        using var replacement = CommandSandboxRuntime.OverrideBackendForTests(new RecordingBackend());
        var missing = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"), "rg-missing.exe");
        var context = Context(JsonSerializer.Serialize(new { search = new { rg_path = missing } }), []);
        var request = Request(ToolHostControls.CapabilitiesId, Json("{}"), context);
        request.Approved = false;
        var response = (await ToolRegistry.DispatchAsync(request)).Response;
        Assert.False(response.GetProperty("ripgrep").GetProperty("available").GetBoolean());
        Assert.Equal(missing, response.GetProperty("ripgrep").GetProperty("path").GetString());
        Assert.True(response.GetProperty("sandbox").GetProperty("supported").GetBoolean());
        Assert.True(response.GetProperty("sandbox").GetProperty("initialized").GetBoolean());
        Assert.True(response.GetProperty("sandbox").GetProperty("frozen_grants").GetBoolean());
        Assert.True(response.GetProperty("web").GetProperty("address_guard").GetBoolean());
        Assert.Equal(5, response.GetProperty("shells").GetArrayLength());
    }

    [Fact]
    public async Task ExplicitWebParamsCannotWidenFrozenByteAndTextCeilings()
    {
        var args = new WebFetchArgs { Url = "https://budget.test/", ConfirmFetch = "read text", MaxBytes = 1000, MaxChars = 1000 };
        async Task<WebFetchResult> Fetch() => await WebFetchTool.FetchAsync(args,
            (_, _) => Task.FromResult(new[] { IPAddress.Parse("1.1.1.1") }), CancellationToken.None, () => new TextHandler());
        using (ToolExecutionContext.Enter(Context("{\"web\":{\"max_bytes\":64,\"max_chars\":8}}", ["web_fetch"])))
        {
            var capped = await Fetch();
            Assert.True(capped.Success, capped.Error);
            Assert.Equal(64, capped.ByteCount);
            Assert.Equal(8, capped.Text!.Length);
            Assert.True(capped.Truncated);
            args.MaxBytes = 4; args.MaxChars = 4;
            var smaller = await Fetch();
            Assert.Equal(4, smaller.ByteCount);
            Assert.Equal(4, smaller.Text!.Length);
        }
        args.MaxBytes = 1000; args.MaxChars = 1000;
        var ordinary = await Fetch();
        Assert.True(ordinary.Success, ordinary.Error);
        Assert.Equal(200, ordinary.ByteCount);
        Assert.Equal(200, ordinary.Text!.Length);
    }

    private sealed class TextHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(new string('x', 200)) });
    }

    [Fact]
    public void McpFingerprintsIncludeScopeAndConfigButIgnoreEnvironmentMapOrder()
    {
        var a = new McpServerConfig { Id = "same", ResourceId = "a", Command = "node", Args = ["server.js"], Env = new() { ["A"] = "1", ["B"] = "2" } };
        var b = new McpServerConfig { Id = "same", ResourceId = "a", Command = "node", Args = ["server.js"], Env = new() { ["B"] = "2", ["A"] = "1" } };
        Assert.Equal(McpClientPool.PoolKey(a), McpClientPool.PoolKey(b));
        b.ResourceId = "b";
        Assert.NotEqual(McpClientPool.PoolKey(a), McpClientPool.PoolKey(b));
        b.ResourceId = "a"; b.Revision = 1;
        Assert.NotEqual(McpClientPool.PoolKey(a), McpClientPool.PoolKey(b));
    }

    [Fact]
    public void ProtectedBranchesAndBootstrapSettingsRemainIsolatedBetweenContexts()
    {
        using (ToolExecutionContext.Enter(Context("{\"git\":{\"protected_branches\":[\"release\"]}}", ["git_push"])))
        {
            Assert.False(ProtectedBranchGuard.EvaluatePushBranch("release").Allowed);
            Assert.True(ProtectedBranchGuard.EvaluatePushBranch("main").Allowed);
        }
        using (ToolExecutionContext.Enter(Context("{\"git\":{\"protected_branches\":[\"main\"]}}", ["git_push"])))
        {
            Assert.True(ProtectedBranchGuard.EvaluatePushBranch("release").Allowed);
            Assert.False(ProtectedBranchGuard.EvaluatePushBranch("main").Allowed);
        }
    }

    [Fact]
    public async Task RealGitOutputBudgetIsAppliedWithoutChangingLaterCalls()
    {
        using var workspace = new WorkspaceTestDirectory();
        using (ToolExecutionContext.Enter(Context("{\"git\":{\"max_output_chars\":3}}", ["git_status"])))
        {
            var limited = await GitCli.RunAsync(workspace.Path, ["--version"]);
            Assert.False(limited.Ok);
            Assert.True(limited.Truncated);
            Assert.Equal(3, limited.Stdout.Length);
        }
        using (ToolExecutionContext.Enter(Context("{\"git\":{\"max_output_chars\":1024}}", ["git_status"])))
        {
            var ordinary = await GitCli.RunAsync(workspace.Path, ["--version"]);
            Assert.True(ordinary.Ok, ordinary.Stderr);
            Assert.StartsWith("git version", ordinary.Stdout);
        }
    }

    [Fact]
    public async Task RealGitOperationBudgetsKeepLogAndDiffIndependent()
    {
        using var repo = new TempGitRepo("operation-budgets");
        repo.SeedInitialCommit("budget.txt", "initial\n");
        File.WriteAllText(Path.Combine(repo.Path, "budget.txt"), new string('x', 4000) + "\n");
        var context = Context("{\"git\":{\"max_output_chars\":8192,\"tool_budgets\":{\"git_log\":{\"max_output_chars\":4096},\"git_diff\":{\"max_output_chars\":512}}}}", ["git_log", "git_diff"]);
        var parameters = JsonSerializer.SerializeToElement(new { repository_path = repo.Path, target = "working_tree" });
        var log = (await ToolRegistry.DispatchAsync(Request("git_log", parameters, context))).Response;
        Assert.True(log.GetProperty("success").GetBoolean(), log.GetRawText());
        Assert.Equal(1, log.GetProperty("commits").GetArrayLength());
        var diff = (await ToolRegistry.DispatchAsync(Request("git_diff", parameters, context))).Response;
        Assert.True(diff.GetProperty("success").GetBoolean(), diff.GetRawText());
        Assert.True(diff.GetProperty("truncated").GetBoolean());
        Assert.Equal(512, diff.GetProperty("sections")[0].GetProperty("diff").GetString()!.Length);
        var unrestricted = (await ToolRegistry.DispatchAsync(Request("git_diff", parameters, Context("{\"git\":{\"max_output_chars\":8192}}", ["git_diff"])))).Response;
        Assert.True(unrestricted.GetProperty("success").GetBoolean(), unrestricted.GetRawText());
        Assert.False(unrestricted.GetProperty("truncated").GetBoolean());
        Assert.True(unrestricted.GetProperty("sections")[0].GetProperty("diff").GetString()!.Length > 4000);
        Assert.Null(ToolExecutionContext.CurrentCallToolId);
    }

    [Fact]
    public async Task RealGitLogDefaultsRespectExplicitPagingLimits()
    {
        using var repo = new TempGitRepo("log-defaults");
        repo.SeedInitialCommit("log.txt", "one\n");
        repo.CommitFile("log.txt", "two\n", "second");
        repo.CommitFile("log.txt", "three\n", "third");
        var context = Context("{\"git\":{\"log_limit\":1,\"log_list_limit\":2}}", ["git_log", "git_log_list"]);
        var parameters = JsonSerializer.SerializeToElement(new { repository_path = repo.Path });
        var log = (await ToolRegistry.DispatchAsync(Request("git_log", parameters, context))).Response;
        Assert.True(log.GetProperty("success").GetBoolean(), log.GetRawText());
        Assert.Equal(1, log.GetProperty("commits").GetArrayLength());
        var list = (await ToolRegistry.DispatchAsync(Request("git_log_list", parameters, context))).Response;
        Assert.True(list.GetProperty("success").GetBoolean(), list.GetRawText());
        Assert.Equal(2, list.GetProperty("commits").GetArrayLength());
        Assert.True(list.GetProperty("truncated").GetBoolean());
        var explicitLimit = JsonSerializer.SerializeToElement(new { repository_path = repo.Path, limit = 3 });
        foreach (var toolId in new[] { "git_log", "git_log_list" })
        {
            var result = (await ToolRegistry.DispatchAsync(Request(toolId, explicitLimit, context))).Response;
            Assert.True(result.GetProperty("success").GetBoolean(), result.GetRawText());
            Assert.Equal(3, result.GetProperty("commits").GetArrayLength());
        }
    }

    [Fact]
    public async Task MutationByteCeilingKeepsOriginalBytesAndHashChecksMandatory()
    {
        using var workspace = new WorkspaceTestDirectory();
        var path = workspace.CreateFile("edit.txt", "abc");
        var hash = FileHashing.ComputeFileHash(File.ReadAllBytes(path));
        var context = Context("{\"write\":{\"max_file_bytes\":4}}", ["insert_bytes", "write_file"]);
        var tooLarge = await ToolRegistry.DispatchAsync(Request("insert_bytes", JsonSerializer.SerializeToElement(new
            { filepath = path, start_offset = 3, content = "de", file_hash = hash }), context));
        Assert.False(tooLarge.Response.GetProperty("success").GetBoolean());
        Assert.Equal("abc", File.ReadAllText(path));
        var stale = await ToolRegistry.DispatchAsync(Request("write_file", JsonSerializer.SerializeToElement(new
            { filepath = path, content = "x", file_hash = "stale" }), context));
        Assert.False(stale.Response.GetProperty("success").GetBoolean());
        Assert.Contains("hash mismatch", stale.Response.GetProperty("error").GetString());
        Assert.Equal("abc", File.ReadAllText(path));
    }

    [Fact]
    public async Task BrokenMcpImportDoesNotBlockOtherCategories()
    {
        var context = Json("{\"schema_version\":1,\"settings\":{},\"allowed_tool_ids\":[\"mcp_list\",\"ls\"],\"mcp_import_error\":\"Invalid JSON in project config\"}");
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => ToolRegistry.DispatchAsync(Request("mcp_list", Json("{}"), context)).AsTask());
        Assert.Contains("Invalid JSON", error.Message);
        using var workspace = new WorkspaceTestDirectory();
        var result = await ToolRegistry.DispatchAsync(Request("ls", JsonSerializer.SerializeToElement(new { path = workspace.Path }), context));
        Assert.True(result.Response.GetProperty("success").GetBoolean());
    }

    private sealed class RecordingBackend : ISandboxBackend
    {
        public bool IsSupported => true;
        public bool IsInitialized => true;
        public SandboxRunnerRequest? Request { get; private set; }
        public Task EnsureSetupAsync(CancellationToken ct) => Task.CompletedTask;
        public Task ResetAsync(SandboxResetScope scope, CancellationToken ct) => Task.CompletedTask;
        public Task<SandboxRunnerResponse> ExecuteAsync(SandboxRunnerRequest request, SandboxPermissions permissions, bool persistGrants, CancellationToken ct)
        {
            Request = request;
            return Task.FromResult(new SandboxRunnerResponse { Success = true, Stdout = "output", Stderr = "error" });
        }
    }
}
