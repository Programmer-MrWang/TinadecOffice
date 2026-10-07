using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.AgentConfiguration;
using TinadecCore.DmaEA;
using TinadecCore.Memory;

namespace TinadecCore.Api.Tests;

public sealed partial class StorageApiTests
{
    [Fact]
    public async Task InteractionModeSnapshot_DoesNotChangeTheSessionsNewerDefault()
    {
        var coordinator = new ComposerRecordingCoordinator();
        using var factory = _factory!.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services => services.AddSingleton<IFullDuplexRunCoordinator>(coordinator)));
        var client = factory.CreateClient();
        var session = await (await client.PostAsJsonAsync("/api/v1/sessions", new { title = "Queue owner" })).Content.ReadFromJsonAsync<JsonElement>();
        var id = session.GetProperty("id").GetGuid();
        var sentMode = session.GetProperty("mode_version_id").GetGuid();
        var newerMode = Guid.NewGuid();
        await using (var config = await factory.Services.GetRequiredService<IDbContextFactory<AgentConfigurationDbContext>>().CreateDbContextAsync())
        {
            var original = await config.ModeVersions.SingleAsync(x => x.Id == sentMode);
            config.ModeVersions.Add(new ModeVersionRecord
            {
                Id = newerMode, AgentModeId = original.AgentModeId, TenantId = original.TenantId,
                WorkspaceId = original.WorkspaceId, Version = original.Version + 100,
                SnapshotJson = original.SnapshotJson, TopologyHash = original.TopologyHash,
                Status = "published", CreatedAt = DateTimeOffset.UtcNow, CreatedByPrincipalId = original.CreatedByPrincipalId
            });
            await config.SaveChangesAsync();
        }
        var saved = await client.PatchAsJsonAsync($"/api/v1/sessions/{id}", new { mode_version_id = newerMode, expected_settings_revision = 0 });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var expectedRevision = (await saved.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("settings_revision").GetInt64();

        // Promoting a queued message reuses its original mode and message id;
        // its earlier settings snapshot does not ask to update future defaults.
        var response = await client.PostAsJsonAsync($"/api/v1/sessions/{id}/interactions", new
        {
            content = "The previously queued request", client_message_id = "queued-before-mode-change",
            dispatch_mode = "parallel", mode_version_id = sentMode, clear_meeting_model_override = true
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(sentMode, coordinator.Invocation!.ModeVersionId);
        Assert.True(coordinator.Invocation.SessionSettingsCaptured);
        Assert.Null(coordinator.Invocation.MeetingModelOverride);
        var current = await factory.Services.GetRequiredService<ProjectSessionStore>().GetSessionAsync(id);
        Assert.Equal(newerMode, current!.ModeVersionId);
        Assert.Equal(expectedRevision, current.SettingsRevision);
    }

    private sealed class ComposerRecordingCoordinator : IFullDuplexRunCoordinator
    {
        public FullDuplexInvocation? Invocation { get; private set; }
        public Task<RunSubmission> SubmitAsync(FullDuplexInvocation invocation, CancellationToken cancellationToken = default)
        {
            Invocation = invocation;
            return Task.FromResult(new RunSubmission(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 1, "captured", false));
        }
        public IAsyncEnumerable<RunStreamChunk> FollowAsync(Guid runId, Guid? turnId = null, long afterSequence = 0, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<RunControlResult> ControlAsync(Guid runId, RunControlCommand command, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
