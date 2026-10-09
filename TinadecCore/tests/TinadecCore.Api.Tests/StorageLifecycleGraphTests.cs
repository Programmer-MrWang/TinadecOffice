using System.IO.Compression;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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
using TinadecCore.TinaChat;
using TinadecCore.Tools;

namespace TinadecCore.Api.Tests;

public sealed class StorageLifecycleGraphTests : IAsyncLifetime
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "tinadec-graph-gc-tests", Guid.NewGuid().ToString("N"));
    private readonly TenantContext _actor = new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "owner");
    private ServiceProvider _services = null!;
    private StorageScopeDescriptor _scope = null!;
    private Registry _registry = null!;
    private static readonly Type[] ContextTypes = [typeof(MemoryDbContext), typeof(LifecycleDbContext), typeof(AgentControlDbContext),
        typeof(AgentGraphDbContext), typeof(GovernanceDbContext), typeof(TinaChatDbContext), typeof(AgentConfigurationDbContext),
        typeof(ModelControlDbContext), typeof(PromptControlDbContext), typeof(IntegrationDbContext), typeof(ToolsSettingsDbContext)];

    public async Task InitializeAsync()
    {
        _scope = new("test", "user", _root); Directory.CreateDirectory(_scope.Data);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["TinadecPersistence:DataRoot"] = _scope.Data, ["TinadecPersistence:Sqlite:DatabasePath"] = Path.Combine(_scope.Data, "tinadec.db") }).Build();
        var services = new ServiceCollection(); services.AddSingleton<IScopeStorageLocations>(_scope);
        services.AddSingleton<ITenantContextAccessor>(new Tenant(_actor)); services.AddTinadecPersistence(config, _root);
        var connection = "Data Source=" + Path.Combine(_scope.Data, "tinadec.db");
        services.AddDbContextFactory<MemoryDbContext>(o => o.UseSqlite(connection)); services.AddDbContextFactory<LifecycleDbContext>(o => o.UseSqlite(connection));
        services.AddDbContextFactory<AgentControlDbContext>(o => o.UseSqlite(connection)); services.AddDbContextFactory<AgentGraphDbContext>(o => o.UseSqlite(connection));
        services.AddDbContextFactory<GovernanceDbContext>(o => o.UseSqlite(connection)); services.AddDbContextFactory<TinaChatDbContext>(o => o.UseSqlite(connection));
        services.AddDbContextFactory<AgentConfigurationDbContext>(o => o.UseSqlite(connection)); services.AddDbContextFactory<ModelControlDbContext>(o => o.UseSqlite(connection));
        services.AddDbContextFactory<PromptControlDbContext>(o => o.UseSqlite(connection)); services.AddDbContextFactory<IntegrationDbContext>(o => o.UseSqlite(connection));
        services.AddDbContextFactory<ToolsSettingsDbContext>(o => o.UseSqlite(connection));
        _services = services.BuildServiceProvider(); _registry = new(_scope, _services);
        foreach (var type in ContextTypes)
        {
            var factoryType = typeof(IDbContextFactory<>).MakeGenericType(type);
            var factory = _services.GetRequiredService(factoryType);
            await using var db = (DbContext)factoryType.GetMethod("CreateDbContext")!.Invoke(factory, null)!;
            await DbContextSchemaBootstrapper.EnsureTablesAsync(db);
        }
    }

    [Fact]
    public async Task PurgeRemovesCrossModuleOwnedFactsAndPreservesGlobalAuthorityAndOtherSession()
    {
        var session = Guid.NewGuid(); var otherSession = Guid.NewGuid(); var run = Guid.NewGuid(); var otherRun = Guid.NewGuid();
        var approval = Guid.NewGuid(); var task = Guid.NewGuid(); var instance = Guid.NewGuid(); var parent = Guid.NewGuid();
        var body = await Put("attachment", "historic attachment");
        await With<MemoryDbContext>(db =>
        {
            db.Sessions.AddRange(Session(session), Session(otherSession));
            db.Messages.Add(new() { Id = Guid.NewGuid(), TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = session, RunId = run, Sequence = 1, ContentReference = body.Value });
            db.MessageAttachments.Add(new() { Id = Guid.NewGuid(), TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = session, FileName = "history.txt", ContentReference = body.Value });
            db.MemoryItems.Add(new() { Id = Guid.NewGuid(), TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, Kind = "shared" });
        });
        await With<LifecycleDbContext>(db =>
        {
            db.Runs.AddRange(Run(run, session), Run(otherRun, otherSession));
            db.RunCheckpoints.Add(new() { Id = Guid.NewGuid(), TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, RunId = run, Revision = 1, IdempotencyKey = "owned", ContentReference = body.Value });
            db.ApprovalRequests.Add(new() { Id = approval, TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = session, RunId = run, ParametersReference = body.Value });
            db.ApprovalDecisions.Add(new() { Id = Guid.NewGuid(), ApprovalRequestId = approval, Decision = "approved" });
            db.ToolExecutions.Add(new() { Id = Guid.NewGuid(), TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = session, RunId = run, TaskId = task, AgentInstanceId = instance, ToolId = "write_file", ToolCallKey = "owned", ApprovalId = approval, ResultReference = body.Value });
            db.ModelInvocations.Add(new() { Id = Guid.NewGuid(), CallId = Guid.NewGuid(), TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = session, RunId = run, Status = "completed" });
        });
        await With<AgentControlDbContext>(db => db.Set<AgentInstanceRecord>().Add(new() { Id = instance, TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = session, RunId = run }));
        await With<GovernanceDbContext>(db => db.CapabilityGrants.AddRange(
            Grant(parent), Grant(Guid.NewGuid(), run, task, parent), Grant(Guid.NewGuid(), otherRun, Guid.NewGuid(), parent)));
        var graph = await ScopeSessionDataGraph.ReadAsync(_services, session);
        Assert.Contains(body.Value, graph.ContentReferences);
        Assert.DoesNotContain(graph.Entities.SelectMany(x => x.Rows).OfType<CapabilityGrantRecord>(), g => g.Id == parent || g.RunId == otherRun);
        await ScopeSessionDataGraph.DeleteAsync(_services, graph);
        await With<MemoryDbContext>(db => { Assert.Equal(otherSession, Assert.Single(db.Sessions).Id); Assert.Empty(db.Messages); Assert.Empty(db.MessageAttachments); Assert.Single(db.MemoryItems); }, false);
        await With<LifecycleDbContext>(db => { Assert.Equal(otherRun, Assert.Single(db.Runs).Id); Assert.Empty(db.RunCheckpoints); Assert.Empty(db.ApprovalRequests); Assert.Empty(db.ApprovalDecisions); Assert.Empty(db.ToolExecutions); Assert.Empty(db.ModelInvocations); }, false);
        await With<AgentControlDbContext>(db => Assert.Empty(db.Set<AgentInstanceRecord>()), false);
        await With<GovernanceDbContext>(db => { Assert.Equal(2, db.CapabilityGrants.Count()); Assert.Contains(db.CapabilityGrants, x => x.Id == parent); }, false);
    }

    [Fact]
    public async Task PurgeJournalCompletesAllParticipantsAfterTheSourceSessionAlreadyDisappeared()
    {
        var session = Guid.NewGuid(); var run = Guid.NewGuid(); var parent = Guid.NewGuid(); var approval = Guid.NewGuid();
        await With<MemoryDbContext>(db => { db.Sessions.Add(Session(session)); db.MessageAttachments.Add(new() { Id = Guid.NewGuid(), TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = session, FileName = "owned.txt" }); });
        await With<LifecycleDbContext>(db => { db.Runs.Add(Run(run, session)); db.ApprovalRequests.Add(new() { Id = approval, TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = session, RunId = run }); db.ApprovalDecisions.Add(new() { Id = Guid.NewGuid(), ApprovalRequestId = approval, Decision = "approved" }); });
        await With<GovernanceDbContext>(db => db.CapabilityGrants.AddRange(Grant(parent), Grant(Guid.NewGuid(), run, Guid.NewGuid(), parent)));
        var graph = await ScopeSessionDataGraph.ReadAsync(_services, session);
        var journal = Path.Combine(_scope.State, "session-purges", session.ToString("N") + ".toml");
        await ScopeSessionDataGraph.WriteSnapshotAsync(journal, graph, default);
        // Simulate an interruption after Memory committed, before other participants did.
        await With<MemoryDbContext>(db => { db.MessageAttachments.RemoveRange(db.MessageAttachments); db.Sessions.RemoveRange(db.Sessions); });
        var paths = _services.GetRequiredService<StoragePaths>();
        var store = new ProjectSessionStore(_services.GetRequiredService<IDbContextFactory<MemoryDbContext>>(), paths,
            _services.GetRequiredService<IContentStore>(), _services.GetRequiredService<ITenantContextAccessor>());
        var lifecycle = new ProjectSessionLifecycleService(store, _services.GetRequiredService<IDbContextFactory<LifecycleDbContext>>(), paths, services: _services);
        await lifecycle.RecoverPendingPurgesAsync(); await lifecycle.RecoverPendingPurgesAsync();
        Assert.False(File.Exists(journal));
        await With<LifecycleDbContext>(db => { Assert.Empty(db.Runs); Assert.Empty(db.ApprovalRequests); Assert.Empty(db.ApprovalDecisions); }, false);
        await With<GovernanceDbContext>(db => Assert.Equal(parent, Assert.Single(db.CapabilityGrants).Id), false);
    }

    [Fact]
    public async Task ExplicitContentCollectionKeepsSharedAndNestedReferencesAndOnlyDeletesUnreachableBytes()
    {
        var shared = await Put("message", "shared body"); var nested = await Put("model-config", "nested provider bytes");
        var frozen = await Put("run_configuration", "{\"provider\":\"" + nested.Value + "\"}"); var orphan = await Put("attachment", "unreachable bytes");
        var session = Guid.NewGuid(); var other = Guid.NewGuid(); var run = Guid.NewGuid();
        await With<MemoryDbContext>(db =>
        {
            db.Sessions.AddRange(Session(session), Session(other));
            db.Messages.AddRange(new MessageRecord { Id = Guid.NewGuid(), TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = session, Sequence = 1, ContentReference = shared.Value },
                new MessageRecord { Id = Guid.NewGuid(), TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = other, Sequence = 1, ContentReference = shared.Value });
        });
        await With<LifecycleDbContext>(db => { var record = Run(run, other); record.FrozenConfigurationReference = frozen.Value; db.Runs.Add(record); });
        await ScopeSessionDataGraph.DeleteAsync(_services, await ScopeSessionDataGraph.ReadAsync(_services, session));
        var collection = new ContentCollectionService(_registry); var preview = await collection.PreviewAsync(_scope.StorageId, default);
        Assert.Equal([orphan.Value], preview.References); await collection.ApplyAsync(_scope.StorageId, preview.PreviewId, default);
        var content = _services.GetRequiredService<IContentStore>();
        Assert.False(await content.ExistsAsync(orphan)); Assert.True(await content.ExistsAsync(shared)); Assert.True(await content.ExistsAsync(nested)); Assert.True(await content.ExistsAsync(frozen));
    }

    [Fact]
    public async Task SQLiteExportIncludesAConsistentRestorableDatabaseAndItsContentBodies()
    {
        var session = Guid.NewGuid(); var body = await Put("message", "exported body");
        await With<MemoryDbContext>(db => { db.Sessions.Add(Session(session)); db.Messages.Add(new() { Id = Guid.NewGuid(), TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = session, Sequence = 1, ContentReference = body.Value }); });
        var archive = await new StorageMaintenanceService(_registry).ExportAsync(_scope.StorageId, default);
        var restored = Path.Combine(_root, "restored"); ZipFile.ExtractToDirectory(archive, restored);
        await using var db = new MemoryDbContext(new DbContextOptionsBuilder<MemoryDbContext>().UseSqlite("Data Source=" + Path.Combine(restored, "data", "tinadec.db")).Options);
        Assert.Equal(session, (await db.Sessions.SingleAsync()).Id); Assert.Equal(body.Value, (await db.Messages.SingleAsync()).ContentReference);
        Assert.Equal("exported body", await File.ReadAllTextAsync(Path.Combine(restored, "data", body.Value.Replace('/', Path.DirectorySeparatorChar))));
    }

    [Fact]
    public async Task ContentReaderLeaseBlocksCollectionUntilTheActualStreamCloses()
    {
        var orphan = await Put("attachment", "active reader bytes");
        var content = _services.GetRequiredService<IContentStore>(); var leases = _services.GetRequiredService<IContentLeaseRegistry>();
        var reader = await content.OpenReadAsync(orphan); Assert.Equal(1, leases.Count);
        var collection = new ContentCollectionService(_registry);
        await Assert.ThrowsAsync<InvalidOperationException>(() => collection.PreviewAsync(_scope.StorageId, default));
        Assert.True(reader.CanRead); Assert.True(await content.ExistsAsync(orphan));
        await reader.DisposeAsync(); Assert.Equal(0, leases.Count);
        var preview = await collection.PreviewAsync(_scope.StorageId, default); await collection.ApplyAsync(_scope.StorageId, preview.PreviewId, default);
        Assert.False(await content.ExistsAsync(orphan));
    }

    private SessionRecord Session(Guid id) => new() { Id = id, TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, Title = "owned" };
    private RunRecord Run(Guid id, Guid session) => new() { Id = id, TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, SessionId = session, Status = "completed" };
    private CapabilityGrantRecord Grant(Guid id, Guid? run = null, Guid? task = null, Guid? parent = null) => new() { Id = id, TenantId = _actor.TenantId, WorkspaceId = _actor.WorkspaceId, RunId = run, TaskId = task, ParentGrantId = parent, Capability = "tool.invoke", Action = "write", Resource = "workspace" };
    private Task<ContentReference> Put(string kind, string text) => _services.GetRequiredService<IContentStore>().PutAsync(new(_actor.TenantId, _actor.WorkspaceId, kind, "application/json", new MemoryStream(Encoding.UTF8.GetBytes(text))));
    private async Task With<T>(Action<T> action, bool save = true) where T : DbContext
    { await using var db = await _services.GetRequiredService<IDbContextFactory<T>>().CreateDbContextAsync(); action(db); if (save) await db.SaveChangesAsync(); }
    public async Task DisposeAsync() { await _services.DisposeAsync(); Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); if (Directory.Exists(_root)) Directory.Delete(_root, true); }
    private sealed class Tenant(TenantContext actor) : ITenantContextAccessor { public TenantContext Current => actor; }
    private sealed class Registry(StorageScopeDescriptor scope, IServiceProvider services) : IStorageScopeRegistry
    {
        public StorageScopeDescriptor User => scope; public IReadOnlyList<StorageScopeDescriptor> List() => [scope]; public bool GetWritePolicy(string id) => false;
        public Task<StorageRuntimeLease> AcquireAsync(string id, CancellationToken ct = default) => Task.FromResult(new StorageRuntimeLease(scope, services, () => { }));
        public Task<StorageRuntimeLease> AcquireExclusiveAsync(string id, CancellationToken ct = default) => AcquireAsync(id, ct);
        public Task<StorageScopeDescriptor> OpenAsync(OpenStorageScopeRequest request, CancellationToken ct = default) => throw new NotSupportedException();
        public Task CloseAsync(string id, CancellationToken ct = default) => Task.CompletedTask;
        public Task SetWritePolicyAsync(string id, bool value, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<StorageScopeDescriptor> ConfigureAsync(string id, string backend, string? root, string? reference, CancellationToken ct = default) => throw new NotSupportedException();
        public Task UnregisterAsync(string id, CancellationToken ct = default) => throw new NotSupportedException();
    }
}
