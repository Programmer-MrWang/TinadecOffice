using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Contracts.Dtos;
using Microsoft.Extensions.DependencyInjection;

namespace TinadecCore.Api.Tests;

public sealed partial class MarketCatalogApiTests
{
    private const string GitCommit = "1234567890123456789012345678901234567890";

    [Theory]
    [InlineData("https://github.com/acme/skills/tree/main/pdf-forms")]
    [InlineData("https://user:secret@github.com/acme/skills/tree/1234567890123456789012345678901234567890")]
    [InlineData("http://github.com/acme/skills/tree/1234567890123456789012345678901234567890")]
    [InlineData("https://github.com/acme/skills/tree/1234567890123456789012345678901234567890?token=secret")]
    public async Task GitSkillSourceRequiresPublicHttpsPinnedCommit(string location)
    {
        var response = await Client.PostAsJsonAsync("/api/v1/market/sources", new { name = "git-skills", kind = "skill_git", location });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(Provider.Urls);
    }

    [Theory]
    [InlineData("")]
    [InlineData("packages/pdf-forms/")]
    public async Task GitSkillSourceSupportsRootAndSubdirectoryPackages(string prefix)
    {
        var source = await CreateGitSkillSourceAsync();
        var body = Encoding.UTF8.GetBytes(SkillDocument("pdf-forms"));
        Provider.Replies.Enqueue(Wire.Ok(GitTree(false, (prefix + "SKILL.md", body, "100644"), (prefix + "references/help.txt", "instructions"u8.ToArray(), "100644"))));
        Provider.Replies.Enqueue(Wire.Ok(GitBlob(body)));
        var refresh = await RefreshAsync(source);
        Assert.Equal("fetched", refresh.GetProperty("outcome").GetString());
        Assert.Equal(1, refresh.GetProperty("fetched_rows").GetInt32());
        var catalog = await CatalogAsync();
        var item = Assert.Single(catalog.GetProperty("items").EnumerateArray());
        Assert.Equal("pdf-forms", item.GetProperty("extension_id").GetString());
        Assert.Equal(GitCommit, item.GetProperty("version").GetString());
        Assert.All(Provider.Urls, x => Assert.StartsWith("https://api.github.com/repos/acme/skills/git/", x));
    }

    [Fact]
    public async Task GitSkillSourceRejectsTruncatedTreeWithoutPublishingPartialPackage()
    {
        var source = await CreateGitSkillSourceAsync();
        Provider.Replies.Enqueue(Wire.Ok(GitTree(true, ("pdf-forms/SKILL.md", Encoding.UTF8.GetBytes(SkillDocument("pdf-forms")), "100644"))));
        var refresh = await RefreshAsync(source);
        Assert.Equal("unavailable", refresh.GetProperty("outcome").GetString());
        Assert.Empty((await CatalogAsync()).GetProperty("items").EnumerateArray());
        Assert.Single(Provider.Urls);
    }

    [Theory]
    [InlineData("120000")]
    [InlineData("160000")]
    public async Task GitSkillPackageRefusesLinksAndSubmodulesBeforeFetchingBodies(string mode)
    {
        var source = await CreateGitSkillSourceAsync();
        Provider.Replies.Enqueue(Wire.Ok(GitTree(false, ("pdf-forms/SKILL.md", Encoding.UTF8.GetBytes(SkillDocument("pdf-forms")), "100644"),
            ("pdf-forms/references/outside", "outside"u8.ToArray(), mode))));
        var refresh = await RefreshAsync(source);
        Assert.Equal(1, refresh.GetProperty("refused_rows").GetInt32());
        Assert.Empty((await CatalogAsync()).GetProperty("items").EnumerateArray());
        Assert.Single(Provider.Urls);
    }

    [Fact]
    public async Task GitSkillSourceVerifiesBlobObjectHash()
    {
        var source = await CreateGitSkillSourceAsync();
        var original = Encoding.UTF8.GetBytes(SkillDocument("pdf-forms"));
        var changed = original.ToArray(); changed[^1] ^= 1;
        Provider.Replies.Enqueue(Wire.Ok(GitTree(false, ("pdf-forms/SKILL.md", original, "100644"))));
        Provider.Replies.Enqueue(Wire.Ok(JsonSerializer.Serialize(new { sha = GitObjectHash(original), encoding = "base64", content = Convert.ToBase64String(changed) })));
        var refresh = await RefreshAsync(source);
        Assert.Equal("unavailable", refresh.GetProperty("outcome").GetString());
        Assert.Contains("hash", refresh.GetProperty("reason").GetString());
        Assert.Empty((await CatalogAsync()).GetProperty("items").EnumerateArray());
    }

    [Fact]
    public async Task ApprovedPinnedGitPackageRetainsBodyReferencesScriptsAndBinaryAsset()
    {
        var source = await CreateGitSkillSourceAsync();
        var body = Encoding.UTF8.GetBytes(SkillDocument("pdf-forms"));
        var reference = Encoding.UTF8.GetBytes("Read the whole PDF before editing.");
        var script = Encoding.UTF8.GetBytes("print('skill-ready')\n");
        byte[] binary = [0, 255, 4, 128, 10];
        var tree = GitTree(false, ("pdf-forms/SKILL.md", body, "100644"), ("pdf-forms/references/help.txt", reference, "100644"),
            ("pdf-forms/scripts/helper.py", script, "100755"), ("pdf-forms/assets/sample.bin", binary, "100644"));
        Provider.Replies.Enqueue(Wire.Ok(tree));
        Provider.Replies.Enqueue(Wire.Ok(GitBlob(body)));
        await RefreshAsync(source);
        var entry = Assert.Single((await CatalogAsync()).GetProperty("items").EnumerateArray()).GetProperty("catalog_id").GetString();
        Provider.Replies.Enqueue(Wire.Ok(tree));
        foreach (var data in new[] { body, reference, script, binary }) Provider.Replies.Enqueue(Wire.Ok(GitBlob(data)));
        var proposal = await PreviewAsync($"/api/v1/market/catalog/{entry}/install-preview", new { scope = "shared" });
        Assert.Equal(4, proposal.GetProperty("package_files").GetArrayLength());
        var applied = await PostAsync($"/api/v1/market/install-proposals/{proposal.GetProperty("id")}/apply");
        Assert.Equal("completed", await ApproveAsync(applied.GetProperty("install_action_id").GetString()!));
        var resourceId = proposal.GetProperty("resource_id").GetGuid();
        var detail = await GetJsonAsync($"/api/v1/tools/skills/{resourceId}");
        Assert.Contains("name: pdf-forms", detail.GetProperty("content").GetString());
        Assert.Equal(4, detail.GetProperty("package_files").GetArrayLength());
        foreach (var (path, expected) in new[] { ("references/help.txt", reference), ("scripts/helper.py", script), ("assets/sample.bin", binary) })
        {
            var file = await GetJsonAsync($"/api/v1/tools/skills/{resourceId}/files?path={Uri.EscapeDataString(path)}");
            Assert.Equal(expected, Convert.FromBase64String(file.GetProperty("base64").GetString()!));
        }
        var catalog = await _factory!.Services.GetRequiredService<IToolSkillCatalog>().ResolveAsync(null, [resourceId]);
        Assert.Equal(resourceId, Assert.Single(catalog).ResourceId);
        Assert.Equal(binary, await File.ReadAllBytesAsync(Path.Combine(catalog[0].RootPath, "assets", "sample.bin")));
        Assert.Equal("available", Assert.Single((await GetJsonAsync("/api/v1/market/installations")).GetProperty("installations").EnumerateArray()).GetProperty("availability").GetString());
    }

    private async Task<string> CreateGitSkillSourceAsync()
    {
        var response = await Client.PostAsJsonAsync("/api/v1/market/sources", new { name = "git-skills", kind = "skill_git", location = $"https://github.com/acme/skills/tree/{GitCommit}" });
        await _factory!.AssertStatusAsync(response, HttpStatusCode.OK, "Create Git source");
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString()!;
    }

    private static string GitTree(bool truncated, params (string Path, byte[] Bytes, string Mode)[] files) => JsonSerializer.Serialize(new
    {
        truncated,
        tree = files.Select(x => new { path = x.Path, sha = GitObjectHash(x.Bytes), mode = x.Mode, type = x.Mode == "160000" ? "commit" : "blob", size = x.Bytes.Length }),
    });
    private static string GitBlob(byte[] bytes) => JsonSerializer.Serialize(new { sha = GitObjectHash(bytes), encoding = "base64", content = Convert.ToBase64String(bytes) });
    private static string GitObjectHash(byte[] bytes)
    {
        var header = Encoding.ASCII.GetBytes("blob " + bytes.Length.ToString(System.Globalization.CultureInfo.InvariantCulture) + "\0");
        return Convert.ToHexStringLower(SHA1.HashData([.. header, .. bytes]));
    }
}
