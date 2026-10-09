using System.Net.Http.Json;
using System.Text.Json;
using TinadecCore.Abstractions.Ports;

namespace TinadecCore.Api.Tests;

public sealed partial class MarketCatalogApiTests
{
    [Fact]
    public async Task SharedSkillWithoutProjectUsesStableIdAndCanBeDisabledAfterApproval()
    {
        var source = await CreateSkillSourceAsync();
        var entry = await RefreshedSkillEntryAsync(source, new SkillRow("shared-lifecycle"));
        Provider.Replies.Enqueue(Wire.Ok(SkillDocument("shared-lifecycle")));
        var proposal = await PreviewAsync($"/api/v1/market/catalog/{entry}/install-preview", new { scope = "shared" });
        Assert.Equal("shared", proposal.GetProperty("scope").GetString());
        var id = proposal.GetProperty("resource_id").GetGuid();
        var applied = await PostAsync($"/api/v1/market/install-proposals/{proposal.GetProperty("id")}/apply");
        Assert.Equal("completed", await ApproveAsync(applied.GetProperty("install_action_id").GetString()!));
        var resource = await GetJsonAsync($"/api/v1/tools/skills/{id}");
        Assert.True(resource.GetProperty("enabled").GetBoolean());
        Provider.Replies.Enqueue(Wire.Ok(SkillDocument("shared-lifecycle") + "\nUpdated body"));
        var updated = await PreviewAsync($"/api/v1/market/catalog/{entry}/install-preview", new { scope = "shared" });
        Assert.Equal(id, updated.GetProperty("resource_id").GetGuid());
        var update = await PostAsync($"/api/v1/market/install-proposals/{updated.GetProperty("id")}/apply");
        Assert.Equal("completed", await ApproveAsync(update.GetProperty("install_action_id").GetString()!));
        var installed = Assert.Single((await GetJsonAsync("/api/v1/market/installations")).GetProperty("installations").EnumerateArray());
        Assert.Equal("available", installed.GetProperty("availability").GetString());
        var removal = await PostAsync($"/api/v1/market/installations/{installed.GetProperty("id")}/uninstall-preview");
        var removing = await PostAsync($"/api/v1/market/install-proposals/{removal.GetProperty("id")}/apply");
        Assert.Equal("completed", await ApproveAsync(removing.GetProperty("uninstall_action_id").GetString()!));
        Assert.False((await GetJsonAsync($"/api/v1/tools/skills/{id}")).GetProperty("enabled").GetBoolean());
    }
}
