using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;
using TinadecCore.Runtime;

namespace TinadecCore.Api.Tests;

public sealed class StorageScopeApiTests : IAsyncLifetime
{
    private readonly string _root = ApiTestStorage.CreateRoot("storage-scopes");
    private ScopeFactory? _factory;
    private readonly string _token = Guid.NewGuid().ToString("N");
    private string? _previousToken;
    public Task InitializeAsync()
    { _previousToken = Environment.GetEnvironmentVariable("TINADEC_HOST_CONTROL_TOKEN"); Environment.SetEnvironmentVariable("TINADEC_HOST_CONTROL_TOKEN", _token); Directory.CreateDirectory(_root); _factory = new(_root, _token); return Task.CompletedTask; }
    public async Task DisposeAsync()
    { try { if (_factory is not null) await _factory.DisposeAsync(); Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); if (Directory.Exists(_root)) Directory.Delete(_root, true); }
      finally { Environment.SetEnvironmentVariable("TINADEC_HOST_CONTROL_TOKEN", _previousToken); } }

    [Fact]
    public async Task ConcurrentOpen_IsIdempotent_AndDoesNotOverwriteProjectConfiguration()
    {
        using var client = _factory!.CreateClient();
        var path = Path.Combine(_root, "project"); Directory.CreateDirectory(path);
        var responses = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => client.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = path })));
        foreach (var response in responses) response.EnsureSuccessStatusCode();
        var scopes = await Task.WhenAll(responses.Select(x => x.Content.ReadFromJsonAsync<JsonElement>()));
        Assert.Single(scopes.Select(x => x.GetProperty("storage_id").GetString()).Distinct());
        Assert.True(File.Exists(Path.Combine(path, ".tinadec", "project.toml")));
        var configuration = Path.Combine(path, ".tinadec", "config", "tools.toml");
        await File.AppendAllTextAsync(configuration, "\n# user comment\n");
        (await client.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = path })).EnsureSuccessStatusCode();
        Assert.Contains("# user comment", await File.ReadAllTextAsync(configuration));
        var ignore = await File.ReadAllTextAsync(Path.Combine(path, ".tinadec", ".gitignore"));
        Assert.Contains("/data/", ignore); Assert.DoesNotContain("/config/", ignore);
    }

    [Fact]
    public async Task ProjectRequests_AreIsolated_AndUnknownScopeCannotSelectArbitraryStorage()
    {
        using var client = _factory!.CreateClient();
        var a = await OpenAsync(client, "a"); var b = await OpenAsync(client, "b");
        using var create = new HttpRequestMessage(HttpMethod.Post, "/api/v1/sessions") { Content = JsonContent.Create(new { project_id = a.GetProperty("project_id").GetString(), title = "A session" }) };
        create.Headers.Add("X-Tinadec-Storage-Id", a.GetProperty("storage_id").GetString());
        var response = await client.SendAsync(create); response.EnsureSuccessStatusCode();
        var session = await response.Content.ReadFromJsonAsync<JsonElement>();
        using var wrong = new HttpRequestMessage(HttpMethod.Get, "/api/v1/sessions/" + session.GetProperty("id").GetString() + "/messages");
        wrong.Headers.Add("X-Tinadec-Storage-Id", b.GetProperty("storage_id").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(wrong)).StatusCode);
        using var unknown = new HttpRequestMessage(HttpMethod.Get, "/api/v1/sessions"); unknown.Headers.Add("X-Tinadec-Storage-Id", Path.Combine(_root, "data"));
        Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(unknown)).StatusCode);
        var aggregate = await client.GetFromJsonAsync<JsonElement>("/api/v1/sessions");
        Assert.Contains(aggregate.EnumerateArray(), x => x.GetProperty("id").GetString() == session.GetProperty("id").GetString() && x.GetProperty("storage_id").GetString() == a.GetProperty("storage_id").GetString());
    }

    [Fact]
    public async Task CacheCleanup_RequiresPreview_AndPreservesDataConfigAndCredentials()
    {
        using var client = _factory!.CreateClient(); var scope = await OpenAsync(client, "cleanup");
        var storage = scope.GetProperty("storage_root").GetString()!; var id = scope.GetProperty("storage_id").GetString()!;
        await File.WriteAllTextAsync(Path.Combine(storage, "cache", "rebuildable"), "cache");
        await File.WriteAllTextAsync(Path.Combine(storage, "data", "fact"), "fact");
        var previewResponse = await client.PostAsJsonAsync($"/api/v1/storage/scopes/{id}/cleanup-preview", new { category = "cache" }); previewResponse.EnsureSuccessStatusCode();
        var preview = await previewResponse.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Remove("X-Tinadec-Host-Control");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/v1/storage/scopes/{id}/cleanup", new { preview_id = preview.GetProperty("preview_id").GetString() })).StatusCode);
        using var apply = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/storage/scopes/{id}/cleanup")
        { Content = JsonContent.Create(new { preview_id = preview.GetProperty("preview_id").GetString() }) };
        apply.Headers.Add("X-Tinadec-Host-Control", _token);
        (await client.SendAsync(apply)).EnsureSuccessStatusCode();
        client.DefaultRequestHeaders.Add("X-Tinadec-Host-Control", _token);
        Assert.False(File.Exists(Path.Combine(storage, "cache", "rebuildable"))); Assert.True(File.Exists(Path.Combine(storage, "data", "fact")));
        Assert.True(File.Exists(Path.Combine(storage, "config", "agents.toml")));
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync($"/api/v1/storage/scopes/{id}/cleanup-preview", new { category = "data" })).StatusCode);
        client.DefaultRequestHeaders.Remove("X-Tinadec-Host-Control");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/v1/storage/scopes/{id}/write-policy", new { allow_storage_write = true })).StatusCode);
    }

    [Fact]
    public async Task Move_RebindsHostIdentity_WhileCopyGetsIndependentStorageIdentity()
    {
        using var client = _factory!.CreateClient();
        var original = await OpenAsync(client, "original");
        var id = original.GetProperty("storage_id").GetString()!;
        (await client.PostAsync($"/api/v1/storage/scopes/{id}/close", null)).EnsureSuccessStatusCode();
        var movedPath = Path.Combine(_root, "moved");
        Directory.Move(Path.Combine(_root, "original"), movedPath);
        var movedResponse = await client.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = movedPath });
        movedResponse.EnsureSuccessStatusCode(); var moved = await movedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(id, moved.GetProperty("storage_id").GetString());
        Assert.Equal(original.GetProperty("project_id").GetString(), moved.GetProperty("project_id").GetString());
        (await client.PostAsync($"/api/v1/storage/scopes/{id}/close", null)).EnsureSuccessStatusCode();
        var copyPath = Path.Combine(_root, "copy"); Directory.CreateDirectory(copyPath);
        await StorageScopeInitializer.CopyOwnedTreeAsync(movedPath, copyPath, CancellationToken.None);
        var copiedResponse = await client.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = copyPath });
        copiedResponse.EnsureSuccessStatusCode(); var copied = await copiedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEqual(id, copied.GetProperty("storage_id").GetString());
        Assert.Equal(moved.GetProperty("project_id").GetString(), copied.GetProperty("project_id").GetString());
    }

    [Fact]
    public async Task ExternalMode_RecoversItsRegistration_WithoutWritingProjectStorage()
    {
        using var client = _factory!.CreateClient();
        var path = Path.Combine(_root, "external-project"); Directory.CreateDirectory(path);
        var storage = Path.Combine(_root, "external-store");
        var response = await client.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = path, storage_root = storage });
        response.EnsureSuccessStatusCode(); var original = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(original.GetProperty("external").GetBoolean()); Assert.False(Directory.Exists(Path.Combine(path, ".tinadec")));
        await File.AppendAllTextAsync(Path.Combine(storage, "config", "tools.toml"), "\n# external user edit\n");
        await _factory.DisposeAsync(); _factory = new(_root, _token);
        using var restarted = _factory.CreateClient();
        var opened = await restarted.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = path }); opened.EnsureSuccessStatusCode();
        var restored = await opened.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(original.GetProperty("storage_id").GetString(), restored.GetProperty("storage_id").GetString());
        Assert.Equal(storage, restored.GetProperty("storage_root").GetString());
        Assert.Contains("# external user edit", await File.ReadAllTextAsync(Path.Combine(storage, "config", "tools.toml")));
    }

    [Fact]
    public async Task ConflictingOrCorruptStorage_IsReportedAndNeverOverwritten()
    {
        using var client = _factory!.CreateClient();
        var path = Path.Combine(_root, "conflict"); Directory.CreateDirectory(path);
        var storage = Path.Combine(path, ".tinadec"); await File.WriteAllTextAsync(storage, "user file");
        var conflict = await client.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = path });
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode); Assert.Equal("user file", await File.ReadAllTextAsync(storage));
        File.Delete(storage); Directory.CreateDirectory(storage);
        await File.WriteAllTextAsync(Path.Combine(storage, "project.toml"), "schema_version = [broken");
        var corrupt = await client.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = path });
        Assert.Equal(HttpStatusCode.Conflict, corrupt.StatusCode);
        Assert.Equal("schema_version = [broken", await File.ReadAllTextAsync(Path.Combine(storage, "project.toml")));
    }

    [Fact]
    public async Task Close_WaitsForAnExistingLease_AndCancellationRestoresAdmission()
    {
        using var client = _factory!.CreateClient(); var scope = await OpenAsync(client, "leases");
        var id = scope.GetProperty("storage_id").GetString()!;
        var registry = _factory.Services.GetRequiredService<IStorageScopeRegistry>();
        var lease = await registry.AcquireAsync(id);
        var closing = registry.CloseAsync(id);
        Assert.False(closing.IsCompleted);
        client.DefaultRequestHeaders.Add("X-Tinadec-Storage-Id", id);
        using var refusedStream = await client.GetAsync($"/api/v1/runs/{Guid.NewGuid()}/stream/", HttpCompletionOption.ResponseHeadersRead);
        Assert.Equal(HttpStatusCode.Conflict, refusedStream.StatusCode);
        Assert.Contains("closing", await refusedStream.Content.ReadAsStringAsync());
        await lease.DisposeAsync(); await closing.WaitAsync(TimeSpan.FromSeconds(10));
        await using var reopened = await registry.AcquireAsync(id);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => registry.CloseAsync(id, cancellation.Token));
        await using var admitted = await registry.AcquireAsync(id);
        Assert.Equal(id, admitted.Descriptor.StorageId);
    }

    [Fact]
    public async Task ChangingStorageRoot_CreatesIndependentData_AndRetainsOldStoreAndProjectIdentity()
    {
        using var client = _factory!.CreateClient(); var original = await OpenAsync(client, "relocate");
        var id = original.GetProperty("storage_id").GetString()!;
        var oldRoot = original.GetProperty("storage_root").GetString()!;
        await File.WriteAllTextAsync(Path.Combine(oldRoot, "data", "retained-fact"), "do not migrate");
        var newRoot = Path.Combine(_root, "new-storage");
        var changed = await client.PostAsJsonAsync($"/api/v1/storage/scopes/{id}/configure", new { backend = "sqlite", storage_root = newRoot });
        changed.EnsureSuccessStatusCode(); var dto = await changed.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(newRoot, dto.GetProperty("storage_root").GetString());
        Assert.Equal(original.GetProperty("project_id").GetString(), dto.GetProperty("project_id").GetString());
        Assert.True(File.Exists(Path.Combine(oldRoot, "data", "retained-fact")));
        Assert.False(File.Exists(Path.Combine(newRoot, "data", "retained-fact")));
        Assert.Contains("backend = \"sqlite\"", await File.ReadAllTextAsync(Path.Combine(newRoot, "config", "storage.toml")));
    }

    [Fact]
    public async Task DeletingProjectStorage_RequiresItsPreview_AndPreservesCode()
    {
        using var client = _factory!.CreateClient(); var scope = await OpenAsync(client, "delete-storage");
        var id = scope.GetProperty("storage_id").GetString()!;
        var code = Path.Combine(scope.GetProperty("project_root").GetString()!, "main.txt"); await File.WriteAllTextAsync(code, "project code");
        var previewResponse = await client.PostAsJsonAsync($"/api/v1/storage/scopes/{id}/storage-delete-preview", new { });
        Assert.True(previewResponse.IsSuccessStatusCode, await previewResponse.Content.ReadAsStringAsync());
        var preview = await previewResponse.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Remove("X-Tinadec-Host-Control");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/v1/storage/scopes/{id}/storage-delete", new { preview_id = preview.GetProperty("preview_id").GetString() })).StatusCode);
        client.DefaultRequestHeaders.Add("X-Tinadec-Host-Control", _token);
        var deleted = await client.PostAsJsonAsync($"/api/v1/storage/scopes/{id}/storage-delete", new { preview_id = preview.GetProperty("preview_id").GetString() });
        Assert.True(deleted.IsSuccessStatusCode, await deleted.Content.ReadAsStringAsync()); Assert.True(File.Exists(code));
        Assert.False(Directory.Exists(scope.GetProperty("storage_root").GetString()));
        var registrations = await client.GetFromJsonAsync<JsonElement>("/api/v1/storage/scopes");
        Assert.DoesNotContain(registrations.EnumerateArray(), row => row.GetProperty("storage_id").GetString() == id);
    }

    private async Task<JsonElement> OpenAsync(HttpClient client, string name)
    {
        var path = Path.Combine(_root, name); Directory.CreateDirectory(path);
        var response = await client.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = path, name }); response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    [Fact]
    public async Task DeletionPreviewRejectsChangedDatabaseFactsAndPreservesProjectStorage()
    {
        using var client = _factory!.CreateClient(); var scope = await OpenAsync(client, "changed-facts");
        var id = scope.GetProperty("storage_id").GetString()!;
        var previewResponse = await client.PostAsJsonAsync($"/api/v1/storage/scopes/{id}/storage-delete-preview", new { });
        Assert.True(previewResponse.IsSuccessStatusCode, await previewResponse.Content.ReadAsStringAsync());
        var preview = await previewResponse.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Add("X-Tinadec-Storage-Id", id);
        var created = await client.PostAsJsonAsync("/api/v1/sessions", new { project_id = scope.GetProperty("project_id").GetString(), title = "new fact after preview" });
        Assert.True(created.IsSuccessStatusCode, await created.Content.ReadAsStringAsync());
        var deleted = await client.PostAsJsonAsync($"/api/v1/storage/scopes/{id}/storage-delete", new { preview_id = preview.GetProperty("preview_id").GetString() });
        var deletionDetail = await deleted.Content.ReadAsStringAsync();
        Assert.True(deleted.StatusCode == HttpStatusCode.Conflict, deletionDetail);
        Assert.Contains("changed after the preview", deletionDetail);
        Assert.True(Directory.Exists(scope.GetProperty("storage_root").GetString()));
        Assert.Empty(Directory.EnumerateFiles(Path.Combine(scope.GetProperty("storage_root").GetString()!, "temp"), "deletion-preview-*.db"));
    }
    [Fact]
    public async Task UntrustedLoopbackCannotReadDataInitializeStorageOrApproveActions()
    {
        using var client = _factory!.CreateClient();
        client.DefaultRequestHeaders.Remove("X-Tinadec-Host-Control");
        var path = Path.Combine(_root, "untrusted"); Directory.CreateDirectory(path);
        foreach (var request in new[]
        {
            new HttpRequestMessage(HttpMethod.Get, "/api/v1/sessions"),
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/storage/scopes/open") { Content = JsonContent.Create(new { project_path = path }) },
            new HttpRequestMessage(HttpMethod.Post, $"/api/v1/approvals/{Guid.NewGuid()}/decision") { Content = JsonContent.Create(new { decision = "approved" }) }
        })
        {
            using (request) Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(request)).StatusCode);
        }
        Assert.False(Directory.Exists(Path.Combine(path, ".tinadec")));
    }

    [Fact]
    public async Task HostShutdownAwaitsConcurrentDisposalAndReleasesOwnedFileHandles()
    {
        using var client = _factory!.CreateClient();
        var scope = await OpenAsync(client, "shutdown");
        var registry = (StorageScopeRegistry)_factory.Services.GetRequiredService<IStorageScopeRegistry>();
        await Task.WhenAll(registry.DisposeAsync().AsTask(), registry.DisposeAsync().AsTask(), _factory.DisposeAsync().AsTask());
        Assert.True(registry.DisposeAsync().IsCompletedSuccessfully);
        foreach (var path in new[]
        {
            Path.Combine(scope.GetProperty("storage_root").GetString()!, "data", "tinadec.db"),
            Path.Combine(_root, "user", "data", "tinadec.db"),
            Path.Combine(_root, "user", "state", "host.lock")
        })
        {
            using var probe = new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.None);
            Assert.True(probe.CanWrite);
        }
    }

    [Fact]
    public async Task PublicChallengeProvesTheCoreRoleAndRejectsInvalidNonces()
    {
        using var client = _factory!.CreateClient(); client.DefaultRequestHeaders.Remove("X-Tinadec-Host-Control");
        var nonce = new string('n', 43);
        var response = await client.GetAsync("/api/v1/host-challenge?nonce=" + nonce);
        response.EnsureSuccessStatusCode(); var proof = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Equal("core", proof.GetProperty("role").GetString()); Assert.Equal(nonce, proof.GetProperty("nonce").GetString());
        var expected = System.Security.Cryptography.HMACSHA256.HashData(System.Text.Encoding.UTF8.GetBytes(_token), System.Text.Encoding.UTF8.GetBytes("tinadec-host-v1\0core\0" + nonce));
        Assert.Equal(Convert.ToHexString(expected).ToLowerInvariant(), proof.GetProperty("proof").GetString());
        Assert.DoesNotContain(_token, await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/v1/host-challenge?nonce=invalid")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/v1/host-challenge?nonce={nonce}&nonce={nonce}")).StatusCode);
    }

    private sealed class ScopeFactory(string root, string token) : IsolatedApiFactory
    {
        protected override bool UsesManagedStorage => true;
        protected override string? ManagedUserRoot => Path.Combine(root, "user");
        protected override void ConfigureClient(HttpClient client)
        {
            base.ConfigureClient(client);
            client.DefaultRequestHeaders.Add("X-Tinadec-Host-Control", token);
        }
        protected override void ConfigureIsolatedWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            { ["TinadecStorage:Enabled"] = "true", ["TinadecStorage:UserRoot"] = Path.Combine(root, "user"),
                ["TinadecTools:DefaultWorkspaceRoot"] = Path.Combine(root, "workspace"), ["Logging:LogLevel:Default"] = "Warning" }));
        }
    }
}
