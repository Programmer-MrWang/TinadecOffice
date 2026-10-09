using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;
using TinadecCore.Runtime;
using Tomlyn;
using Tomlyn.Model;

namespace TinadecCore.Api.Tests;

public sealed class PostgreSqlMultiFolderWorkspaceTests
{
    [PostgreSqlScopeFact]
    public async Task MultiFolderScopesKeepSchemaFactsAndPrimaryChangesIndependentAcrossRestart()
    {
        var connection = Environment.GetEnvironmentVariable("TINADEC_TEST_POSTGRES_CONNECTION")
            ?? throw new InvalidOperationException("An isolated PostgreSQL connection is required.");
        var root = ApiTestStorage.CreateRoot("postgres-workspaces");
        var token = Guid.NewGuid().ToString("N");
        var previousToken = Environment.GetEnvironmentVariable("TINADEC_HOST_CONTROL_TOKEN");
        Environment.SetEnvironmentVariable("TINADEC_HOST_CONTROL_TOKEN", token);
        var schemas = new List<string>();
        Factory? factory = null;
        try
        {
            var a = Path.Combine(root, "a"); var b = Path.Combine(root, "b"); var other = Path.Combine(root, "other");
            foreach (var folder in new[] { a, b, other }) Directory.CreateDirectory(folder);
            factory = new(root, token); using var client = factory.CreateClient();
            await factory.Services.GetRequiredService<ISecretStore>().PutAsync("workspace-postgres", connection);
            async Task<JsonElement> Open(string path, WorkspaceSourceRoot[] roots)
            {
                var response = await client.PostAsJsonAsync("/api/v1/storage/scopes/open", new
                {
                    project_path = path, name = "PG workspace", backend = "postgresql", postgres_connection_reference = "workspace-postgres",
                    roots = roots.Select(source => new { id = source.Id, path = source.Path }), primary_root_id = roots[0].Id
                });
                Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
                var scope = await response.Content.ReadFromJsonAsync<JsonElement>(); schemas.Add("tinadec_" + scope.GetProperty("storage_id").GetString()); return scope;
            }
            var first = await Open(a, [new("a", a), new("b", b)]); var second = await Open(other, [new("other", other)]);
            var id = first.GetProperty("storage_id").GetString()!; var secondId = second.GetProperty("storage_id").GetString()!;
            var registry = factory.Services.GetRequiredService<IStorageScopeRegistry>();
            var vectorTenant = Guid.NewGuid(); var vectorProject = Guid.NewGuid();
            var vectorSearch = new ProjectVectorSearch { TenantId = vectorTenant, ProjectId = vectorProject, ModelId = "workspace-probe", Embedding = [1f, 0f] };
            ProjectVectorRecord VectorRecord(string content, float[] embedding) => new()
            { TenantId = vectorTenant, ProjectId = vectorProject, SourceType = "file", SourceId = "same-source", ModelId = "workspace-probe", Content = content, ContentHash = content, Embedding = embedding };
            await using (var firstLease = await registry.AcquireAsync(id))
            await using (var secondLease = await registry.AcquireAsync(secondId))
            {
                Assert.Equal("tinadec_" + id, new NpgsqlConnectionStringBuilder(firstLease.Services.GetRequiredService<IDatabaseConnectionInfo>().ConnectionString).SearchPath);
                Assert.Equal("tinadec_" + secondId, new NpgsqlConnectionStringBuilder(secondLease.Services.GetRequiredService<IDatabaseConnectionInfo>().ConnectionString).SearchPath);
                var firstVectors = firstLease.Services.GetRequiredService<IProjectVectorDatabase>();
                var secondVectors = secondLease.Services.GetRequiredService<IProjectVectorDatabase>();
                await firstVectors.UpsertAsync(VectorRecord("first vector fact", [1f, 0f]));
                var secondSearch = new ProjectVectorSearch { TenantId = vectorTenant, ProjectId = vectorProject, ModelId = "workspace-probe", Embedding = [1f, 0f, 0f] };
                Assert.Empty(await secondVectors.SearchAsync(secondSearch));
                // Identical domain ids and model names still cannot leak between schemas.
                await secondVectors.UpsertAsync(VectorRecord("second vector fact", [1f, 0f, 0f]));
                Assert.Equal("first vector fact", Assert.Single(await firstVectors.SearchAsync(vectorSearch)).Content);
                var documents = firstLease.Services.GetRequiredService<IScopeConfigurationDocuments>();
                var agents = await documents.ReadAsync("agents");
                Assert.DoesNotContain(agents.Diagnostics, diagnostic => diagnostic.Severity == "error");
                agents = await documents.SaveIfMatchAsync("agents", "# PG precision round trip\n" + agents.Text, agents.ContentHash);
                var mutable = TomlSerializer.Deserialize<TomlTable>(agents.Text)!;
                var version = ((TomlTableArray)mutable["agent_pack_versions"])[0];
                version["created_at"] = DateTimeOffset.Parse(version["created_at"].ToString()!, System.Globalization.CultureInfo.InvariantCulture).AddSeconds(1).ToString("O");
                var refused = await Assert.ThrowsAsync<ConfigurationDocumentException>(() => documents.SaveIfMatchAsync("agents", TomlSerializer.Serialize(mutable), agents.ContentHash));
                Assert.Contains(refused.Diagnostics, diagnostic => diagnostic.Code == "configuration_version_immutable");
                Assert.Equal(agents.Text, (await documents.ReadAsync("agents")).Text);
                Assert.Equal("second vector fact", Assert.Single(await secondVectors.SearchAsync(secondSearch)).Content);
                await secondVectors.DeleteSourceAsync(new() { TenantId = vectorTenant, ProjectId = vectorProject, SourceType = "file", SourceId = "same-source" });
                Assert.Empty(await secondVectors.SearchAsync(secondSearch));
                Assert.Equal("first vector fact", Assert.Single(await firstVectors.SearchAsync(vectorSearch)).Content);
            }
            using var create = new HttpRequestMessage(HttpMethod.Post, "/api/v1/sessions")
            { Content = JsonContent.Create(new { project_id = first.GetProperty("project_id").GetString(), title = "first schema fact" }) };
            create.Headers.Add("X-Tinadec-Storage-Id", id);
            var created = await client.SendAsync(create); Assert.True(created.IsSuccessStatusCode, await created.Content.ReadAsStringAsync());
            var session = await created.Content.ReadFromJsonAsync<JsonElement>();
            using var wrong = new HttpRequestMessage(HttpMethod.Get, "/api/v1/sessions/" + session.GetProperty("id").GetString() + "/messages");
            wrong.Headers.Add("X-Tinadec-Storage-Id", secondId); Assert.Equal(System.Net.HttpStatusCode.NotFound, (await client.SendAsync(wrong)).StatusCode);
            var workspaces = factory.Services.GetRequiredService<IWorkspaceRegistry>(); var definition = workspaces.ReadWorkspace(id);
            await workspaces.EditWorkspaceAsync(id, new("Edited PG workspace", [new("a", a), new("b", b)], "b"), definition.ContentHash);
            Assert.False(Directory.Exists(Path.Combine(b, ".tinadec")));
            Assert.Equal(Path.Combine(a, ".tinadec"), factory.Services.GetRequiredService<IStorageScopeRegistry>().List().Single(scope => scope.StorageId == id).Root);
            // A legacy extension installed inside a scope must never be removed
            // by a cascading storage deletion that would affect another workspace.
            await using (var extensionAdmin = new NpgsqlConnection(connection))
            {
                await extensionAdmin.OpenAsync();
                await using var namespaceQuery = new NpgsqlCommand("SELECT quote_ident(n.nspname) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector'", extensionAdmin);
                var originalNamespace = (string)(await namespaceQuery.ExecuteScalarAsync())!;
                try
                {
                    await using var relocate = new NpgsqlCommand("ALTER EXTENSION vector SET SCHEMA \"tinadec_" + secondId + "\"", extensionAdmin); await relocate.ExecuteNonQueryAsync();
                    var refusal = await Assert.ThrowsAsync<InvalidOperationException>(() => factory.Services.GetRequiredService<StorageMaintenanceService>().PreviewDeleteAsync(secondId, CancellationToken.None));
                    Assert.Contains("database-wide extension", refusal.Message);
                    Assert.True(Directory.Exists(Path.Combine(other, ".tinadec")));
                    await using var intact = await registry.AcquireAsync(id);
                    Assert.Equal("first vector fact", Assert.Single(await intact.Services.GetRequiredService<IProjectVectorDatabase>().SearchAsync(vectorSearch)).Content);
                }
                finally
                {
                    await using var restore = new NpgsqlCommand("ALTER EXTENSION vector SET SCHEMA " + originalNamespace, extensionAdmin); await restore.ExecuteNonQueryAsync();
                }
            }
            await factory.DisposeAsync(); factory = new(root, token); using var restarted = factory.CreateClient();
            Assert.Equal(b, factory.Services.GetRequiredService<IWorkspaceRegistry>().ReadWorkspace(id, true).PrimaryPath);
            await using (var restartedLease = await factory.Services.GetRequiredService<IStorageScopeRegistry>().AcquireAsync(id))
                Assert.Equal("first vector fact", Assert.Single(await restartedLease.Services.GetRequiredService<IProjectVectorDatabase>().SearchAsync(vectorSearch)).Content);
            using var list = new HttpRequestMessage(HttpMethod.Get, "/api/v1/sessions"); list.Headers.Add("X-Tinadec-Storage-Id", id);
            var listed = await restarted.SendAsync(list); listed.EnsureSuccessStatusCode();
            Assert.Contains((await listed.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray(), item => item.GetProperty("id").GetString() == session.GetProperty("id").GetString());
        }
        finally
        {
            try
            {
                if (factory is not null) await factory.DisposeAsync();
                NpgsqlConnection.ClearAllPools();
                await using var admin = new NpgsqlConnection(connection); await admin.OpenAsync();
                foreach (var schema in schemas)
                {
                    Assert.Matches("^tinadec_[a-f0-9]{32}$", schema);
                    await using var command = new NpgsqlCommand("DROP SCHEMA IF EXISTS \"" + schema + "\" CASCADE", admin); await command.ExecuteNonQueryAsync();
                }
            }
            finally
            {
                Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
                Environment.SetEnvironmentVariable("TINADEC_HOST_CONTROL_TOKEN", previousToken);
                if (Directory.Exists(root)) Directory.Delete(root, true);
            }
        }
    }

    private sealed class Factory(string root, string token) : IsolatedApiFactory
    {
        protected override bool UsesManagedStorage => true;
        protected override string? ManagedUserRoot => Path.Combine(root, "user");
        protected override void ConfigureClient(HttpClient client) { base.ConfigureClient(client); client.DefaultRequestHeaders.Add("X-Tinadec-Host-Control", token); }
        protected override void ConfigureIsolatedWebHost(IWebHostBuilder builder) => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["Logging:LogLevel:Default"] = "Warning" }));
    }
}
