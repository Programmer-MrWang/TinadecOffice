using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Contracts.Dtos;
using TinadecCore.Lifecycle;
using TinadecCore.Tools;

namespace TinadecCore.Api.Tests;

public sealed partial class StorageApiTests
{
    [Fact]
    public async Task SpatialWorktreeScope_RefusesTheOriginalRootAfterItsAssignmentIsReleased()
    {
        var root = Path.Combine(_root, "workspace");
        var worktree = Path.Combine(_root, "isolated-worktree");
        Directory.CreateDirectory(root);
        Directory.CreateDirectory(worktree);
        var client = _factory!.CreateClient();
        var project = await (await client.PostAsJsonAsync("/api/v1/projects", new { name = "Isolation", path = root })).Content.ReadFromJsonAsync<JsonElement>();
        var session = await (await client.PostAsJsonAsync("/api/v1/sessions", new { project_id = project.GetProperty("id").GetGuid(), view_mode = "space" })).Content.ReadFromJsonAsync<JsonElement>();
        var sessionId = session.GetProperty("id").GetGuid();
        var message = await (await client.PostAsJsonAsync($"/api/v1/sessions/{sessionId}/messages", new { content = "Read in isolation" })).Content.ReadFromJsonAsync<JsonElement>();
        var lifecycle = _factory.Services.GetRequiredService<StorageLifecycleService>();
        var run = await lifecycle.StartRunAsync(sessionId, message.GetProperty("id").GetGuid());
        var taskId = Guid.NewGuid();
        var agentId = Guid.NewGuid();
        var tool = new ToolManifestEntryDto
        {
            Id = "read_file", Description = "read", Risk = "low", RetrySafety = "safe",
            InputSchema = JsonSerializer.SerializeToElement(new { type = "object" })
        };
        var hash = ToolManifestHasher.Compute([tool]);
        var body = JsonSerializer.Serialize(new
        {
            toolManifestProtocolVersion = 2, toolManifestHash = hash, toolManifest = new[] { tool },
            permissionMode = "ask", spaceOptions = new SpaceRunOptions(Worktree: true)
        }, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        await lifecycle.FreezeRunConfigurationAsync(run.Id, new FrozenRunConfigurationWrite("3", body, []));
        var tenant = _factory.Services.GetRequiredService<ITenantContextAccessor>();
        var auth = new AgentToolAuthorization(tenant.Current.TenantId, tenant.Current.WorkspaceId,
            sessionId, run.Id, taskId, agentId, ["read_file"], ["read:."]);
        var leases = _factory.Services.GetRequiredService<IResourceLeaseService>();
        var acquired = await leases.AcquireAsync(new ResourceAcquireRequest(
            new ResourceClaim(ResourceLeaseKinds.Worktree, worktree, true), sessionId, run.Id,
            Purpose: ResourceLeasePurposes.Assignment));
        Assert.True(acquired.Granted);
        using var scopeServices = new ServiceCollection()
            .AddSingleton<IAgentToolAuthorization>(new WorktreeScopeAuthorization(auth))
            .AddSingleton(_factory.Services.GetRequiredService<IToolExecutionTargetResolver>())
            .BuildServiceProvider();
        var resolver = new ToolInvocationScopeResolver(
            _factory.Services.GetRequiredService<ILifecycleManager>(),
            _factory.Services.GetRequiredService<ISessionLocator>(),
            new WorktreeScopeProvider(new ToolManifestDto { ProtocolVersion = 2, ManifestHash = hash, Tools = [tool] }),
            tenant, scopeServices);
        var request = new ToolInvocationScopeRequest(run.Id, taskId, agentId, "read_file");
        Assert.Equal(worktree, (await resolver.ResolveAsync(request)).ExecutionRoot);
        Assert.Equal(1, await leases.ReleaseAsync(acquired.Lease!.Id));
        var rejected = await Assert.ThrowsAsync<InvalidOperationException>(() => resolver.ResolveAsync(request));
        Assert.Contains("cannot be used as a fallback", rejected.Message);
    }

    private sealed class WorktreeScopeAuthorization(AgentToolAuthorization authorization) : IAgentToolAuthorization
    {
        public Task<AgentToolAuthorization?> GetAuthorizationAsync(Guid runId, Guid taskId, Guid agentInstanceId, CancellationToken cancellationToken = default) => Task.FromResult<AgentToolAuthorization?>(authorization);
        public Task<AgentToolAuthorization?> AuthorizeAsync(Guid runId, Guid taskId, Guid agentInstanceId, string toolId, CancellationToken cancellationToken = default) => Task.FromResult<AgentToolAuthorization?>(authorization);
    }

    private sealed class WorktreeScopeProvider(ToolManifestDto manifest) : IToolProvider
    {
        public Task<ToolManifestDto> EnsureStartedAsync(string workspaceRoot, CancellationToken cancellationToken = default) => Task.FromResult(manifest);
        public Task<ToolManifestDto> GetManifestAsync(string workspaceRoot, CancellationToken cancellationToken = default) => Task.FromResult(manifest);
        public Task<ToolWireResponseDto> CallAsync(string workspaceRoot, ToolWireRequestDto request, TimeSpan? timeout = null, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task ShutdownAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
