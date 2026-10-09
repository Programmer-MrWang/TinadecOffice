using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TinadecCore.Abstractions.Ports;
using TinadecCore.AgentConfiguration;
using TinadecCore.AgentGraph;
using TinadecCore.DmaEA;
using TinadecCore.Governance;
using TinadecCore.Lifecycle;
using TinadecCore.Memory;
using TinadecCore.Models;
using TinadecCore.Persistence;
using TinadecCore.Prompts;
using TinadecCore.Runtime;
using TinadecCore.Skills;
using TinadecCore.Tenancy;
using TinadecCore.TinaChat;
using TinadecCore.Tools;

namespace TinadecCore.Api.Tests;

public sealed class PostgreSqlScopeFactAttribute : FactAttribute
{
    public PostgreSqlScopeFactAttribute()
    {
        if (Environment.GetEnvironmentVariable("TINADEC_TEST_POSTGRES") != "1")
            Skip = "A real isolated PostgreSQL service must be explicitly configured.";
    }
}

/// <summary>Real server acceptance of the same scope contract; never uses a user's database or schema.</summary>
public sealed class PostgreSqlScopeValidationTests
{
    [PostgreSqlScopeFact]
    public async Task IndependentSchemasKeepTheSameIdsAndTomlProjectionsIsolatedAcrossTwelveContexts()
    {
        var connection = Environment.GetEnvironmentVariable("TINADEC_TEST_POSTGRES_CONNECTION")
            ?? throw new InvalidOperationException("TINADEC_TEST_POSTGRES_CONNECTION is required.");
        var root = Path.Combine(Path.GetTempPath(), "tinadec-pg-scope-tests", Guid.NewGuid().ToString("N"));
        var firstSchema = "tinadec_test_a_" + Guid.NewGuid().ToString("N"); var secondSchema = "tinadec_test_b_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(connection); await admin.OpenAsync();
        await ExecuteAsync(admin, "CREATE SCHEMA \"" + firstSchema + "\"; CREATE SCHEMA \"" + secondSchema + "\";");
        try
        {
            await using var first = await BuildAsync(Path.Combine(root, "first"), firstSchema, connection);
            await using var second = await BuildAsync(Path.Combine(root, "second"), secondSchema, connection);
            var sessionId = Guid.NewGuid(); var settingId = Guid.NewGuid();
            await PutFactsAsync(first, sessionId, settingId, "first-scope"); await PutFactsAsync(second, sessionId, settingId, "second-scope");
            await using (var db = await first.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync())
                Assert.Equal("first-scope", (await db.Sessions.SingleAsync(s => s.Id == sessionId)).Title);
            await using (var db = await second.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync())
                Assert.Equal("second-scope", (await db.Sessions.SingleAsync(s => s.Id == sessionId)).Title);
            var documents = first.GetRequiredService<IScopeConfigurationDocuments>(); var source = await documents.ReadAsync("tools");
            await documents.SaveIfMatchAsync("tools", source.Text.Replace("first-scope", "edited-file"), source.ContentHash);
            await using (var db = await first.GetRequiredService<IDbContextFactory<ToolsSettingsDbContext>>().CreateDbContextAsync())
                Assert.Contains("edited-file", (await db.Settings.SingleAsync()).SettingsJson);
            await using (var db = await second.GetRequiredService<IDbContextFactory<ToolsSettingsDbContext>>().CreateDbContextAsync())
                Assert.Contains("second-scope", (await db.Settings.SingleAsync()).SettingsJson);
            await first.GetRequiredService<IConfigurationProjectionCoordinator>().CompileAsync();
            await second.GetRequiredService<IConfigurationProjectionCoordinator>().CompileAsync();
            // Rollback in one schema does not leak an intermediate fact into either scope.
            await using (var db = await first.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync())
            {
                await using var transaction = await db.Database.BeginTransactionAsync();
                db.Sessions.Single(s => s.Id == sessionId).Title = "rolled-back"; await db.SaveChangesAsync(); await transaction.RollbackAsync();
            }
            await using (var db = await first.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync())
                Assert.Equal("first-scope", (await db.Sessions.SingleAsync()).Title);
            await VerifyDeletionPreviewTracksDatabaseFactsAsync(first, second, sessionId);
            await using var tables = new NpgsqlCommand("SELECT table_name FROM information_schema.tables WHERE table_schema = @schema", admin);
            tables.Parameters.AddWithValue("schema", firstSchema);
            var actualTables = new HashSet<string>(StringComparer.Ordinal);
            await using (var reader = await tables.ExecuteReaderAsync())
                while (await reader.ReadAsync()) actualTables.Add(reader.GetString(0));
            foreach (var expected in await ExpectedTablesAsync(first)) Assert.Contains(expected, actualTables);
        }
        finally
        {
            NpgsqlConnection.ClearAllPools();
            await ExecuteAsync(admin, "DROP SCHEMA IF EXISTS \"" + firstSchema + "\" CASCADE; DROP SCHEMA IF EXISTS \"" + secondSchema + "\" CASCADE;");
            if (Directory.Exists(root)) Directory.Delete(root, recursive: true);
        }
    }

    private static async Task VerifyDeletionPreviewTracksDatabaseFactsAsync(ServiceProvider first, ServiceProvider second, Guid sessionId)
    {
        var scope = (StorageScopeDescriptor)first.GetRequiredService<IScopeStorageLocations>();
        var maintenance = new StorageMaintenanceService(new PreviewOnlyRegistry(scope, first));
        // The stub cannot delete directories or schemas. Identical facts must pass the
        // fingerprint gate and reach that deliberate host-ownership rejection twice.
        var unchangedFirst = await maintenance.PreviewDeleteAsync(scope.StorageId, CancellationToken.None);
        var unchangedSecond = await maintenance.PreviewDeleteAsync(scope.StorageId, CancellationToken.None);
        foreach (var preview in new[] { unchangedFirst, unchangedSecond })
        {
            var refusal = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                maintenance.DeleteStorageAsync(scope.StorageId, preview.PreviewId, CancellationToken.None));
            Assert.Contains("host cannot close storage", refusal.Message);
        }

        var beforeInsert = await maintenance.PreviewDeleteAsync(scope.StorageId, CancellationToken.None);
        var insertedId = Guid.NewGuid();
        await using (var db = await first.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync())
        {
            db.Sessions.Add(new() { Id = insertedId, TenantId = Actor.TenantId, WorkspaceId = Actor.WorkspaceId, Title = "new fact after preview" });
            await db.SaveChangesAsync();
        }
        var insertRefusal = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            maintenance.DeleteStorageAsync(scope.StorageId, beforeInsert.PreviewId, CancellationToken.None));
        Assert.Contains("changed after the preview", insertRefusal.Message);
        await using (var db = await first.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync())
            Assert.Equal("new fact after preview", (await db.Sessions.SingleAsync(row => row.Id == insertedId)).Title);

        var beforeUpdate = await maintenance.PreviewDeleteAsync(scope.StorageId, CancellationToken.None);
        await using (var db = await first.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync())
        {
            (await db.Sessions.SingleAsync(row => row.Id == sessionId)).Title = "updated fact after preview";
            await db.SaveChangesAsync();
        }
        var updateRefusal = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            maintenance.DeleteStorageAsync(scope.StorageId, beforeUpdate.PreviewId, CancellationToken.None));
        Assert.Contains("changed after the preview", updateRefusal.Message);
        await using (var db = await first.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync())
            Assert.Equal("updated fact after preview", (await db.Sessions.SingleAsync(row => row.Id == sessionId)).Title);
        await using (var db = await second.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync())
        {
            Assert.Equal("second-scope", (await db.Sessions.SingleAsync(row => row.Id == sessionId)).Title);
            Assert.False(await db.Sessions.AnyAsync(row => row.Id == insertedId));
        }
        Assert.True(Directory.Exists(scope.Root));
    }

    private sealed class PreviewOnlyRegistry(StorageScopeDescriptor scope, IServiceProvider services) : IStorageScopeRegistry
    {
        public StorageScopeDescriptor User => new("user", "user", scope.Root + "-unmounted-user");
        public IReadOnlyList<StorageScopeDescriptor> List() => [scope];
        public bool GetWritePolicy(string storageId) => false;
        public Task<StorageRuntimeLease> AcquireAsync(string storageId, CancellationToken ct = default)
        {
            Assert.Equal(scope.StorageId, storageId);
            return Task.FromResult(new StorageRuntimeLease(scope, services, static () => { }));
        }
        public Task<StorageRuntimeLease> AcquireExclusiveAsync(string storageId, CancellationToken ct = default) => AcquireAsync(storageId, ct);
        public Task<StorageScopeDescriptor> OpenAsync(OpenStorageScopeRequest request, CancellationToken ct = default) => throw new NotSupportedException();
        public Task CloseAsync(string storageId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task SetWritePolicyAsync(string storageId, bool allowStorageWrite, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<StorageScopeDescriptor> ConfigureAsync(string storageId, string backend, string? storageRoot, string? postgresConnectionReference,
            CancellationToken ct = default) => throw new NotSupportedException();
        public Task UnregisterAsync(string storageId, CancellationToken ct = default) => throw new NotSupportedException();
    }

    private static readonly TenantContext Actor = new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "owner");
    private static async Task PutFactsAsync(ServiceProvider provider, Guid sessionId, Guid settingId, string label)
    {
        await using (var memory = await provider.GetRequiredService<IDbContextFactory<MemoryDbContext>>().CreateDbContextAsync())
        { memory.Sessions.Add(new() { Id = sessionId, TenantId = Actor.TenantId, WorkspaceId = Actor.WorkspaceId, Title = label }); await memory.SaveChangesAsync(); }
        await using var tools = await provider.GetRequiredService<IDbContextFactory<ToolsSettingsDbContext>>().CreateDbContextAsync();
        tools.Settings.Add(new() { Id = settingId, TenantId = Actor.TenantId, WorkspaceId = Actor.WorkspaceId, ScopeKey = "shared", SettingsJson = "{\"label\":\"" + label + "\"}", Revision = 1 }); await tools.SaveChangesAsync();
    }

    private static async Task<ServiceProvider> BuildAsync(string root, string schema, string connection)
    {
        var scope = new StorageScopeDescriptor(schema, "project", root, Path.GetDirectoryName(root), Guid.NewGuid(), "postgresql", PostgresConnectionReference: "isolated-test-binding");
        foreach (var (_, directory) in scope.Categories) Directory.CreateDirectory(directory);
        File.WriteAllText(Path.Combine(scope.Config, "storage.toml"), "[storage]\nbackend = \"postgresql\"\npostgres_connection_reference = \"isolated-test-binding\"\n");
        File.WriteAllText(Path.Combine(scope.Config, "logging.toml"), "[logging]\nrotation_bytes = 4096\ntotal_bytes = 8192\n");
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["TinadecPersistence:Enabled"] = "true", ["TinadecPersistence:Provider"] = "PostgreSql", ["TinadecPersistence:DataRoot"] = scope.Data,
          ["TinadecPersistence:PostgreSql:Schema"] = schema, ["ConnectionStrings:TinadecCore"] = connection }).Build();
        var services = new ServiceCollection(); services.AddSingleton<IScopeStorageLocations>(scope); services.AddSingleton<ITenantContextAccessor>(new ActorAccessor());
        services.AddTinadecPersistence(config, root);
        Register<MemoryDbContext>(services); Register<LifecycleDbContext>(services); Register<AgentControlDbContext>(services); Register<AgentGraphDbContext>(services);
        Register<GovernanceDbContext>(services); Register<TinaChatDbContext>(services); Register<AgentConfigurationDbContext>(services); Register<ModelControlDbContext>(services);
        Register<PromptControlDbContext>(services); Register<IntegrationDbContext>(services); Register<ToolsSettingsDbContext>(services); Register<TenancyDbContext>(services);
        services.AddTinadecConfigurationFiles(); var provider = services.BuildServiceProvider();
        await InitializeAsync<MemoryDbContext>(provider); await InitializeAsync<LifecycleDbContext>(provider); await InitializeAsync<AgentControlDbContext>(provider); await InitializeAsync<AgentGraphDbContext>(provider);
        await InitializeAsync<GovernanceDbContext>(provider); await InitializeAsync<TinaChatDbContext>(provider); await InitializeAsync<AgentConfigurationDbContext>(provider); await InitializeAsync<ModelControlDbContext>(provider);
        await InitializeAsync<PromptControlDbContext>(provider); await InitializeAsync<IntegrationDbContext>(provider); await InitializeAsync<ToolsSettingsDbContext>(provider); await InitializeAsync<TenancyDbContext>(provider);
        await provider.GetRequiredService<IConfigurationProjectionCoordinator>().ReconcileAsync(); return provider;
    }

    private static void Register<T>(IServiceCollection services) where T : DbContext => services.AddDbContextFactory<T>((sp, options) => options.UseTinadecDatabase(sp));
    private static async Task<IReadOnlySet<string>> ExpectedTablesAsync(ServiceProvider provider)
    {
        var tables = new HashSet<string>(StringComparer.Ordinal);
        await AddAsync<MemoryDbContext>(); await AddAsync<LifecycleDbContext>(); await AddAsync<AgentControlDbContext>(); await AddAsync<AgentGraphDbContext>();
        await AddAsync<GovernanceDbContext>(); await AddAsync<TinaChatDbContext>(); await AddAsync<AgentConfigurationDbContext>(); await AddAsync<ModelControlDbContext>();
        await AddAsync<PromptControlDbContext>(); await AddAsync<IntegrationDbContext>(); await AddAsync<ToolsSettingsDbContext>(); await AddAsync<TenancyDbContext>();
        return tables;
        async Task AddAsync<T>() where T : DbContext
        {
            await using var db = await provider.GetRequiredService<IDbContextFactory<T>>().CreateDbContextAsync();
            foreach (var entity in db.Model.GetEntityTypes()) if (entity.GetTableName() is { } table) tables.Add(table);
        }
    }
    private static async Task InitializeAsync<T>(ServiceProvider provider) where T : DbContext
    { await using var db = await provider.GetRequiredService<IDbContextFactory<T>>().CreateDbContextAsync(); await DbContextSchemaBootstrapper.EnsureTablesAsync(db); }
    private static async Task ExecuteAsync(NpgsqlConnection connection, string sql) { await using var command = new NpgsqlCommand(sql, connection); await command.ExecuteNonQueryAsync(); }
    private sealed class ActorAccessor : ITenantContextAccessor { public TenantContext Current => Actor; }
}
