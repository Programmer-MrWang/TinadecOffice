using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Runtime;

namespace TinadecCore.Api.Tests;

public sealed class MultiFolderWorkspaceTests : IAsyncLifetime
{
    private readonly string _root = ApiTestStorage.CreateRoot("multi-folder-workspaces");
    private readonly string _token = Guid.NewGuid().ToString("N");
    private Factory _factory = null!;
    private string? _previousToken;
    public Task InitializeAsync() { Directory.CreateDirectory(_root); _previousToken = Environment.GetEnvironmentVariable("TINADEC_HOST_CONTROL_TOKEN"); Environment.SetEnvironmentVariable("TINADEC_HOST_CONTROL_TOKEN", _token); _factory = new(_root, _token); return Task.CompletedTask; }
    public async Task DisposeAsync() { try { await _factory.DisposeAsync(); Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); Directory.Delete(_root, true); } finally { Environment.SetEnvironmentVariable("TINADEC_HOST_CONTROL_TOKEN", _previousToken); } }
    private string Folder(string name) { var path = Path.Combine(_root, name); Directory.CreateDirectory(path); return path; }
    private async Task<JsonElement> Create(HttpClient client, string a, string b) {
        var response = await client.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = a, name = "Two folders", roots = new[] { new { id = "a", path = a }, new { id = "b", path = b } }, primary_root_id = "a", icon = "code", color = "blue" });
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync()); return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
    private static HttpRequestMessage Edit(string id, string hash, string a, string b, string primary = "b", string name = "Edited") {
        var request = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/storage/scopes/{id}/workspace") { Content = JsonContent.Create(new { name, roots = new[] { new { id = "a", path = a }, new { id = "b", path = b } }, primary_root_id = primary, icon = "book", color = "green" }) };
        request.Headers.TryAddWithoutValidation("If-Match", '"' + hash + '"'); return request;
    }
    [Fact] public async Task PreviewDoesNotCreateStorageAndCreationOnlyInitializesPrimary() {
        using var client = _factory.CreateClient(); var a = Folder("a"); var b = Folder("b");
        var preview = await client.PostAsJsonAsync("/api/v1/storage/scopes/preview", new { project_path = a }); preview.EnsureSuccessStatusCode();
        Assert.False((await preview.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("exists").GetBoolean()); Assert.False(Directory.Exists(Path.Combine(a, ".tinadec")));
        var opened = await Create(client, a, b);
        Assert.Equal(2, opened.GetProperty("workspace").GetProperty("roots").GetArrayLength());
        Assert.True(File.Exists(Path.Combine(a, ".tinadec", "project.toml"))); Assert.False(Directory.Exists(Path.Combine(b, ".tinadec")));
        client.DefaultRequestHeaders.Add("X-Tinadec-Storage-Id", "user");
        var roster = await client.GetFromJsonAsync<JsonElement>("/api/v1/projects"); Assert.Single(roster.EnumerateArray()); Assert.Equal("a", roster[0].GetProperty("primary_root_id").GetString());
        var existing = await client.PostAsJsonAsync("/api/v1/storage/scopes/preview", new { project_path = b }); existing.EnsureSuccessStatusCode(); Assert.True((await existing.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("exists").GetBoolean());
    }
    [Fact] public async Task ConditionalEditPreservesCommentsStorageAndHistoricalFrozenRoots() {
        using var client = _factory.CreateClient(); var a = Folder("a"); var b = Folder("b"); var scope = await Create(client, a, b);
        var id = scope.GetProperty("storage_id").GetString()!; var registry = _factory.Services.GetRequiredService<IWorkspaceRegistry>();
        var previous = registry.ReadWorkspace(id); var file = Path.Combine(a, ".tinadec", "project.toml");
        await using var originalLease = await _factory.Services.GetRequiredService<IStorageScopeRegistry>().AcquireAsync(id);
        var resolver = originalLease.Services.GetRequiredService<IToolConfigurationResolver>();
        var frozen = await resolver.ResolveForRunAsync(Guid.Parse(scope.GetProperty("project_id").GetString()!), []);
        Assert.Equal(a, frozen.SharedContext.WorkingDirectory);
        await File.AppendAllTextAsync(file, "\n# retained comment\n[custom]\nnote = 'kept' # keep inline\n");
        var text = await File.ReadAllTextAsync(file); using var stale = Edit(id, previous.ContentHash, a, b);
        Assert.Equal(HttpStatusCode.PreconditionFailed, (await client.SendAsync(stale)).StatusCode); Assert.Equal(text, await File.ReadAllTextAsync(file));
        var read = registry.ReadWorkspace(id); using var request = Edit(id, read.ContentHash, a, b); var saved = await client.SendAsync(request); Assert.True(saved.IsSuccessStatusCode, await saved.Content.ReadAsStringAsync());
        var current = registry.ReadWorkspace(id); Assert.Equal(b, current.PrimaryPath); Assert.Equal(a, previous.PrimaryPath);
        var materialized = await resolver.MaterializeForCallAsync(frozen.SharedContext, ["read_file"]);
        Assert.Equal(a, materialized.WorkingDirectory); Assert.Equal(2, materialized.WorkspaceRoots.Count);
        var inSecondary = await resolver.MaterializeForCallAsync(frozen.SharedContext, ["read_file"], workingDirectory: b);
        Assert.Equal(b, inSecondary.WorkingDirectory); Assert.Equal(a, inSecondary.WorkspaceRoots.Single(root => root.Id == "a").Path);
        Assert.Equal(b, inSecondary.WorkspaceRoots.Single(root => root.Id == "b").Path);
        var next = await resolver.ResolveForRunAsync(Guid.Parse(scope.GetProperty("project_id").GetString()!), []);
        Assert.Equal(b, next.SharedContext.WorkingDirectory);
        Assert.Contains("# retained comment", await File.ReadAllTextAsync(file)); Assert.Contains("note = 'kept' # keep inline", await File.ReadAllTextAsync(file));
        Assert.Equal(Path.Combine(a, ".tinadec"), _factory.Services.GetRequiredService<IStorageScopeRegistry>().List().Single(row => row.StorageId == id).Root);
        await originalLease.DisposeAsync(); await _factory.DisposeAsync(); _factory = new(_root, _token); using var restarted = _factory.CreateClient();
        Assert.Equal(b, _factory.Services.GetRequiredService<IWorkspaceRegistry>().ReadWorkspace(id).PrimaryPath);
    }
    [Fact] public async Task InvalidFoldersAndDuplicatePathsLeaveManifestUntouched() {
        using var client = _factory.CreateClient(); var a = Folder("a"); var b = Folder("b"); var scope = await Create(client, a, b);
        var id = scope.GetProperty("storage_id").GetString()!; var file = Path.Combine(a, ".tinadec", "project.toml"); var bytes = await File.ReadAllBytesAsync(file);
        var hash = scope.GetProperty("workspace").GetProperty("content_hash").GetString()!;
        using var duplicate = Edit(id, hash, a, a); Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(duplicate)).StatusCode);
        using var missing = Edit(id, hash, a, Path.Combine(_root, "missing")); Assert.Equal(HttpStatusCode.Conflict, (await client.SendAsync(missing)).StatusCode);
        Assert.Equal(bytes, await File.ReadAllBytesAsync(file)); Assert.False(Directory.Exists(Path.Combine(_root, "missing")));
    }
    [Fact] public async Task CreatingWithAnAnchorOtherThanThePrimaryFolderDoesNotInitializeEitherFolder() {
        using var client = _factory.CreateClient(); var a = Folder("a"); var b = Folder("b");
        var response = await client.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = a, roots = new[] { new { id = "a", path = a }, new { id = "b", path = b } }, primary_root_id = "b" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False(Directory.Exists(Path.Combine(a, ".tinadec"))); Assert.False(Directory.Exists(Path.Combine(b, ".tinadec")));
    }
    [Fact] public async Task MovingAWorkspaceRetainsRootIdentityAndAllowsSubsequentExplicitEdits() {
        using var client = _factory.CreateClient(); var a = Folder("a"); var b = Folder("b"); var scope = await Create(client, a, b);
        var id = scope.GetProperty("storage_id").GetString()!;
        (await client.PostAsync($"/api/v1/storage/scopes/{id}/close", null)).EnsureSuccessStatusCode();
        var moved = Path.Combine(_root, "moved"); Directory.Move(a, moved);
        var preview = _factory.Services.GetRequiredService<IWorkspaceRegistry>().PreviewWorkspace(moved);
        Assert.Equal(moved, preview.Workspace!.Roots.Single(source => source.Id == "a").Path);
        var response = await client.PostAsJsonAsync("/api/v1/storage/scopes/open", new { project_path = moved, roots = preview.Workspace.Roots, primary_root_id = preview.Workspace.PrimaryRootId });
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        Assert.Equal(id, (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("storage_id").GetString());
        var registry = _factory.Services.GetRequiredService<IWorkspaceRegistry>(); var before = registry.ReadWorkspace(id);
        using var edit = Edit(id, before.ContentHash, moved, b, name: "After move");
        var saved = await client.SendAsync(edit); Assert.True(saved.IsSuccessStatusCode, await saved.Content.ReadAsStringAsync());
        Assert.Equal(b, registry.ReadWorkspace(id).PrimaryPath);
        Assert.Equal(moved, registry.ReadWorkspace(id).Roots.Single(source => source.Id == "a").Path);
    }
    [Fact] public async Task ConcurrentEditorsWithSameHashPublishOnlyOneDefinition() {
        using var client = _factory.CreateClient(); var a = Folder("a"); var b = Folder("b"); var scope = await Create(client, a, b);
        var id = scope.GetProperty("storage_id").GetString()!; var hash = scope.GetProperty("workspace").GetProperty("content_hash").GetString()!;
        using var first = Edit(id, hash, a, b, name: "First editor"); using var second = Edit(id, hash, a, b, name: "Second editor");
        var responses = await Task.WhenAll(client.SendAsync(first), client.SendAsync(second));
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.PreconditionFailed);
        var winner = await responses.Single(response => response.StatusCode == HttpStatusCode.OK).Content.ReadFromJsonAsync<JsonElement>();
        var actual = _factory.Services.GetRequiredService<IWorkspaceRegistry>().ReadWorkspace(id, true);
        Assert.Equal(winner.GetProperty("name").GetString(), actual.Name);
        Assert.Equal(winner.GetProperty("content_hash").GetString(), actual.ContentHash);
        Assert.Empty(Directory.GetFiles(Path.Combine(a, ".tinadec"), "project.toml.tmp-*"));
        foreach (var response in responses) response.Dispose();
    }
    [Fact] public async Task CancellingWhileWorkspaceWriteLeaseIsHeldPreservesManifestAndGrants() {
        using var client = _factory.CreateClient(); var a = Folder("a"); var b = Folder("b"); var scope = await Create(client, a, b);
        var id = scope.GetProperty("storage_id").GetString()!; var registry = _factory.Services.GetRequiredService<IWorkspaceRegistry>();
        var before = registry.ReadWorkspace(id); var file = Path.Combine(a, ".tinadec", "project.toml"); var bytes = await File.ReadAllBytesAsync(file);
        using var lease = new FileStream(Path.Combine(a, ".tinadec", "state", ".workspace-write.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(150));
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => registry.EditWorkspaceAsync(id, new("Cancelled editor", before.Roots, "b"), before.ContentHash, cancellation.Token));
        Assert.Equal(bytes, await File.ReadAllBytesAsync(file)); Assert.Equal(a, registry.ReadWorkspace(id).PrimaryPath);
        Assert.Empty(Directory.GetFiles(Path.Combine(a, ".tinadec"), "project.toml.tmp-*"));
    }
    [Fact] public async Task EditingProjectFileCannotGrantAnOutsideFolder() {
        using var client = _factory.CreateClient(); var a = Folder("a"); var b = Folder("b"); var outside = Folder("outside"); var scope = await Create(client, a, b);
        var id = scope.GetProperty("storage_id").GetString()!; var file = Path.Combine(a, ".tinadec", "project.toml");
        var text = await File.ReadAllTextAsync(file); await File.WriteAllTextAsync(file, text.Replace("../b", "../outside", StringComparison.Ordinal));
        var exception = Assert.Throws<ConfigurationDocumentException>(() => _factory.Services.GetRequiredService<IWorkspaceRegistry>().ReadWorkspace(id, true)); Assert.Equal("workspace_authorization_required", exception.Code);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/v1/storage/scopes/{id}/workspace")).StatusCode);
        using var untrusted = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/storage/scopes/{id}/workspace") { Content = JsonContent.Create(new { name = "attempt", roots = new[] { new { id = "a", path = a }, new { id = "b", path = outside } }, primary_root_id = "a" }) };
        client.DefaultRequestHeaders.Remove("X-Tinadec-Host-Control"); Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(untrusted)).StatusCode);
    }
    [Fact] public async Task SnapshotQualifiesSameNamedFilesAndRestoresSecondaryFolder() {
        using var client = _factory.CreateClient(); var a = Folder("a"); var b = Folder("b"); await File.WriteAllTextAsync(Path.Combine(a, "same.txt"), "first"); await File.WriteAllTextAsync(Path.Combine(b, "same.txt"), "second");
        var scope = await Create(client, a, b); var id = scope.GetProperty("storage_id").GetString()!;
        await using var lease = await _factory.Services.GetRequiredService<IStorageScopeRegistry>().AcquireAsync(id); var snapshots = lease.Services.GetRequiredService<IWorkspaceSnapshotService>();
        var snapshot = await snapshots.CreateAsync(new(Guid.Parse(scope.GetProperty("project_id").GetString()!)));
        var files = await snapshots.ListFileChangesAsync(snapshot.Id); Assert.Contains(files, row => row.Path == "a/same.txt"); Assert.Contains(files, row => row.Path == "b/same.txt");
        await File.WriteAllTextAsync(Path.Combine(b, "same.txt"), "changed"); var changed = (await snapshots.ListFileChangesAsync(snapshot.Id)).Single(row => row.Path == "b/same.txt");
        await snapshots.RestoreFileAsync(snapshot.Id, new("b/same.txt", changed.AfterSha256)); Assert.Equal("second", await File.ReadAllTextAsync(Path.Combine(b, "same.txt"))); Assert.Equal("first", await File.ReadAllTextAsync(Path.Combine(a, "same.txt")));
        var registry = _factory.Services.GetRequiredService<IWorkspaceRegistry>(); var current = registry.ReadWorkspace(id);
        await registry.EditWorkspaceAsync(id, new("one source", [new("a", a)], "a"), current.ContentHash);
        Assert.Single(registry.ReadWorkspace(id).Roots);
        await File.WriteAllTextAsync(Path.Combine(b, "same.txt"), "after removal");
        changed = (await snapshots.ListFileChangesAsync(snapshot.Id)).Single(row => row.Path == "b/same.txt");
        await snapshots.RestoreFileAsync(snapshot.Id, new("b/same.txt", changed.AfterSha256)); Assert.Equal("second", await File.ReadAllTextAsync(Path.Combine(b, "same.txt")));
    }
    private sealed class Factory(string root, string token) : IsolatedApiFactory {
        protected override bool UsesManagedStorage => true; protected override string? ManagedUserRoot => Path.Combine(root, "user");
        protected override void ConfigureClient(HttpClient client) { base.ConfigureClient(client); client.DefaultRequestHeaders.Add("X-Tinadec-Host-Control", token); }
        protected override void ConfigureIsolatedWebHost(IWebHostBuilder builder) => builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?> { ["Logging:LogLevel:Default"] = "Warning" }));
    }
}
