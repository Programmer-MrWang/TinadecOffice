using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Contracts.Dtos;
using TinadecCore.Persistence;
using TinadecCore.Skills;

namespace TinadecCore.Api.Tests;

public sealed class ProjectScopeSkillDiscoveryTests
{
    [Fact]
    public async Task HandwrittenProjectScopeSkillIsListedOnceAndItsGovernedDeleteTargetsTheRealPackage()
    {
        var root = Path.Combine(Path.GetTempPath(), "tinadec-project-skill-tests", Guid.NewGuid().ToString("N"));
        var project = Guid.NewGuid(); var actor = new TenantContext(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "owner");
        var locations = new StorageScopeDescriptor("project-test", "project", Path.Combine(root, ".tinadec"), root, project);
        var package = Path.Combine(locations.Skills, "handwritten"); var skill = Path.Combine(package, "SKILL.md");
        Directory.CreateDirectory(Path.Combine(package, "references")); Directory.CreateDirectory(locations.Data);
        await File.WriteAllTextAsync(skill, "---\nname: handwritten\ndescription: User source procedure.\n---\nSource body.\n");
        await File.WriteAllTextAsync(Path.Combine(package, "references", "guide.txt"), "source asset");
        var actions = new Actions(actor);
        using var services = new ServiceCollection().AddSingleton<IUserToolActionService>(actions).BuildServiceProvider();
        try
        {
            var factory = new Factory(new DbContextOptionsBuilder<IntegrationDbContext>()
                .UseSqlite("Data Source=" + Path.Combine(locations.Data, "tinadec.db") + ";Pooling=False").Options);
            await using (var db = await factory.CreateDbContextAsync()) await DbContextSchemaBootstrapper.EnsureTablesAsync(db);
            var paths = new StoragePaths(root, Options.Create(new TinadecPersistenceOptions { DataRoot = locations.Data }), locations);
            var resources = new ToolSkillResourceService(factory, new Tenant(actor), new Locator(new(project, actor.TenantId, actor.WorkspaceId, root)),
                paths, services, new Files());
            var resource = Assert.Single((await resources.ListAsync(project)).Skills);
            Assert.Equal("project", resource.Scope); Assert.Equal(skill, resource.Path); Assert.Equal(project, resource.ProjectId);
            var details = (await resources.GetAsync(resource.ResourceId, project))!;
            Assert.Contains("Source body.", details.Content); Assert.Equal(2, details.PackageFiles.Count);
            var pending = await resources.RequestDeleteAsync(resource.ResourceId, project, details.Revision);
            Assert.Equal("awaiting_user", pending.ActionStatus); Assert.Equal("skill_project_package", actions.Request!.ToolId);
            Assert.Equal(project, actions.Request.ProjectId);
            using var reviewed = JsonDocument.Parse(actions.Request.ParametersJson);
            Assert.Equal("delete", reviewed.RootElement.GetProperty("action").GetString());
            Assert.Equal(package, reviewed.RootElement.GetProperty("package_root").GetString());
            Assert.Equal(2, reviewed.RootElement.GetProperty("expected_file_hashes").EnumerateObject().Count());
            Assert.True(File.Exists(skill)); Assert.Equal("source asset", await File.ReadAllTextAsync(Path.Combine(package, "references", "guide.txt")));
            Assert.Equal(resource.ResourceId, Assert.Single((await resources.ListAsync(project)).Skills).ResourceId);
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }
    private sealed class Tenant(TenantContext actor) : ITenantContextAccessor { public TenantContext Current => actor; }
    private sealed class Locator(ProjectReference project) : ISessionLocator
    {
        public Task<SessionReference?> FindAsync(Guid id, CancellationToken ct = default) => Task.FromResult<SessionReference?>(null);
        public Task<ProjectReference?> FindProjectAsync(Guid id, CancellationToken ct = default) => Task.FromResult<ProjectReference?>(id == project.ProjectId ? project : null);
    }
    private sealed class Factory(DbContextOptions<IntegrationDbContext> options) : IDbContextFactory<IntegrationDbContext>
    {
        public IntegrationDbContext CreateDbContext() => new(options);
        public Task<IntegrationDbContext> CreateDbContextAsync(CancellationToken ct = default) => Task.FromResult(CreateDbContext());
    }
    private sealed class Files : IToolProvider
    {
        public async Task<ToolWireResponseDto> CallAsync(string root, ToolWireRequestDto request, TimeSpan? timeout = null, CancellationToken ct = default)
        {
            Assert.Equal("read_file", request.ToolId);
            var bytes = await File.ReadAllBytesAsync(request.Params!.Value.GetProperty("filepath").GetString()!, ct);
            return new() { IsSuccess = true, Result = JsonSerializer.SerializeToElement(new { file_hash = Convert.ToHexStringLower(SHA256.HashData(bytes)) }) };
        }
        public Task<ToolManifestDto> EnsureStartedAsync(string root, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ToolManifestDto> GetManifestAsync(string root, CancellationToken ct = default) => throw new NotSupportedException();
        public Task ShutdownAsync(CancellationToken ct = default) => Task.CompletedTask;
    }
    private sealed class Actions(TenantContext actor) : IUserToolActionService
    {
        public UserToolActionRequest? Request { get; private set; }
        public Task<UserToolActionResult> CreateAsync(UserToolActionRequest request, CancellationToken ct = default)
        {
            Request = request; var now = DateTimeOffset.UtcNow;
            return Task.FromResult(new UserToolActionResult(Guid.NewGuid(), "test", actor.TenantId, actor.WorkspaceId, request.ProjectId,
                actor.PrincipalId, request.ToolId, "awaiting_user", "high", true, true, null, null, null, null, null, false,
                null, false, null, null, null, null, null, null, null, now, now, null));
        }
        public Task<IReadOnlyList<UserToolActionResult>> ListAsync(string? status = null, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<UserToolActionResult?> GetAsync(Guid id, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<UserToolActionResult> ResumeAsync(Guid id, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<UserToolActionResult> OverrideSnapshotAsync(Guid id, string reason, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<UserToolActionResult> DecideRecoveryAsync(Guid id, string decision, string reason, CancellationToken ct = default) => throw new NotSupportedException();
    }
}
