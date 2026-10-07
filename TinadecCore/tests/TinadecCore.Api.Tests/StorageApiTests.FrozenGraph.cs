using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.Abstractions.Ports;
using TinadecCore.DmaEA;
using TinadecCore.Lifecycle;
using TinadecCore.Memory;

namespace TinadecCore.Api.Tests;

public sealed partial class StorageApiTests
{
    [Fact]
    public async Task OrchestrationGraphs_UseTheRunsFrozenNodesAfterTheSessionSelectionChanges()
    {
        var client = _factory!.CreateClient();
        var session = await (await client.PostAsJsonAsync("/api/v1/sessions", new { view_mode = "space" })).Content.ReadFromJsonAsync<JsonElement>();
        var sessionId = session.GetProperty("id").GetGuid();
        var modeId = session.GetProperty("mode_version_id").GetGuid();
        var message = await (await client.PostAsJsonAsync($"/api/v1/sessions/{sessionId}/messages", new { content = "Frozen graph" })).Content.ReadFromJsonAsync<JsonElement>();
        var lifecycle = _factory.Services.GetRequiredService<StorageLifecycleService>();
        var run = await lifecycle.StartRunAsync(sessionId, message.GetProperty("id").GetGuid());
        var frozen = new FrozenRunConfigurationV1(
            FrozenRunConfigurationV1.CurrentSchemaVersion, "baseline", 1, modeId, "space", "ask",
            new(2, 16, 4), new(2, 2, true), new(true, 2), new(65536, 128, true),
            new(true, 8, [], []), new("test", true, true, 60, 0), [], [], [])
        {
            SpaceOptions = new(),
            Graph = new FrozenGraph(FrozenGraphTiers.SoloDispatch, "frozen-agent", "frozen-root",
                [new FrozenGraphNode("frozen-root", "frozen-agent", "operation", true)], [])
        };
        await lifecycle.FreezeRunConfigurationAsync(run.Id,
            new FrozenRunConfigurationWrite(frozen.SchemaVersion, JsonSerializer.Serialize(frozen, new JsonSerializerOptions(JsonSerializerDefaults.Web)), []));

        // The current session selection is independently mutable. The admitted
        // graph remains renderable even if that later selection is unavailable.
        await using (var db = await _factory.Services.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync())
        {
            var row = await db.Sessions.SingleAsync(x => x.Id == sessionId);
            row.ModeVersionId = Guid.NewGuid();
            row.ConversationTemplateSlug = "later-agent";
            await db.SaveChangesAsync();
        }
        foreach (var url in new[] { $"/api/v1/runs/{run.Id}/orchestration", $"/api/v1/sessions/{sessionId}/orchestration" })
        {
            var response = await client.GetAsync(url);
            Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            var graph = body.GetProperty("graph");
            Assert.Equal("solo_dispatch", graph.GetProperty("tier").GetString());
            var node = Assert.Single(graph.GetProperty("nodes").EnumerateArray());
            Assert.Equal("frozen-root", node.GetProperty("node_key").GetString());
            Assert.True(node.GetProperty("is_conversation").GetBoolean());
        }
    }
}
