using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Contracts.Dtos;
using TinadecCore.Tools;

namespace TinadecCore.Api.Tests;

public sealed class ManagedMcpProgramTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "tinadec-mcp-program-tests", Guid.NewGuid().ToString("N"));
    private readonly Registry _registry = new();
    private readonly Installer _installer = new();
    private readonly ServiceProvider _services = new ServiceCollection().BuildServiceProvider();
    private ManagedMcpProgramService Service(string? root = null) => new(_registry,
        new StorageScopeDescriptor("test", "user", root ?? _root), _installer, _services);

    [Fact]
    public async Task PreviewNeverInstallsAndUnpinnedVersionsAreRejectedWithoutSideEffects()
    {
        var preview = await Service().PreviewAsync(_registry.Resource.ResourceId, null, "install");
        Assert.Equal("not_installed", preview.ProgramStatus); Assert.NotEqual(Guid.Empty, preview.PreviewId);
        Assert.Equal(0, _installer.Calls); Assert.False(Directory.Exists(_root));
        _registry.Resource = new() { ResourceId = preview.ResourceId, Command = "npx", Args = ["example@latest"] };
        var error = await Assert.ThrowsAsync<ToolSettingsException>(() => Service().PreviewAsync(preview.ResourceId, null, "install"));
        Assert.Equal("mcp_program_version_required", error.Code); Assert.False(Directory.Exists(_root));
    }

    [Fact]
    public async Task ExplicitInstallRetainsHistoricalBytesAndTamperingCannotEnterANewRun()
    {
        var service = Service();
        var preview = await service.PreviewAsync(_registry.Resource.ResourceId, null, "install");
        await service.ApplyApprovedAsync(preview);
        Assert.Equal(1, _installer.Calls); Assert.True(_installer.WasApproved);
        Assert.True(File.Exists(Path.Combine(preview.PackageRoot, "installation.toml")));
        var frozen = await service.ResolveForExecutionAsync(_registry.Snapshot);
        Assert.Equal("installed", frozen.ProgramStatus); Assert.NotEqual(preview.PlanHash, frozen.ProgramHash);
        var removal = await service.PreviewAsync(_registry.Resource.ResourceId, null, "uninstall");
        var removed = await service.ApplyApprovedAsync(removal);
        Assert.True(removed.RetainedForHistory); Assert.True(File.Exists(frozen.Args[0]));
        Assert.Equal("not_installed", (await service.ResolveForExecutionAsync(_registry.Snapshot)).ProgramStatus);
        await service.ApplyApprovedAsync(await service.PreviewAsync(_registry.Resource.ResourceId, null, "install"));
        Assert.Equal(1, _installer.Calls);
        await File.WriteAllTextAsync(frozen.Args[0], "changed outside the installer");
        Assert.Equal("invalid", (await service.ResolveForExecutionAsync(_registry.Snapshot)).ProgramStatus);
        var repair = await service.PreviewAsync(_registry.Resource.ResourceId, null, "install");
        Assert.Equal("invalid", repair.ProgramStatus); Assert.NotEqual(frozen.ProgramRoot, repair.PackageRoot);
        await service.ApplyApprovedAsync(repair);
        var repaired = await service.ResolveForExecutionAsync(_registry.Snapshot);
        Assert.Equal("installed", repaired.ProgramStatus); Assert.Equal(2, _installer.Calls);
        Assert.Equal("changed outside the installer", await File.ReadAllTextAsync(frozen.Args[0]));
    }

    [Fact]
    public async Task ChangedRegistrationRejectsReviewedPlanBeforeTheInstallerRuns()
    {
        var service = Service(); var preview = await service.PreviewAsync(_registry.Resource.ResourceId, null, "install");
        _registry.Resource = new() { ResourceId = preview.ResourceId, Command = "npx", Args = ["example@2.0.0"], Revision = 2 };
        var error = await Assert.ThrowsAsync<ToolSettingsException>(() => service.ApplyApprovedAsync(preview));
        Assert.Equal("mcp_program_plan_changed", error.Code); Assert.Equal(0, _installer.Calls); Assert.False(Directory.Exists(_root));
    }

    [Fact]
    public async Task CopiedNpmReceiptsResolveToTheFinalScopeWithoutAnInstall()
    {
        var source = Service(); var preview = await source.PreviewAsync(_registry.Resource.ResourceId, null, "install");
        await source.ApplyApprovedAsync(preview);
        var stage = _root + "-stage"; var final = _root + "-final";
        try
        {
            foreach (var file in Directory.EnumerateFiles(Path.Combine(_root, "packages"), "*", SearchOption.AllDirectories))
            { var target = Path.Combine(stage, Path.GetRelativePath(_root, file)); Directory.CreateDirectory(Path.GetDirectoryName(target)!); File.Copy(file, target); }
            Assert.Empty(await ManagedMcpProgramService.InitializeCopiedResourcesAsync(_root, final, stage));
            Directory.Move(stage, final);
            var copied = await Service(final).ResolveForExecutionAsync(_registry.Snapshot);
            Assert.Equal("installed", copied.ProgramStatus); Assert.StartsWith(final, copied.ProgramRoot);
            Assert.StartsWith(final, copied.Args[0]); Assert.True(File.Exists(copied.Args[0])); Assert.Equal(1, _installer.Calls);
        }
        finally { if (Directory.Exists(stage)) Directory.Delete(stage, true); if (Directory.Exists(final)) Directory.Delete(final, true); }
    }

    public void Dispose() { _services.Dispose(); if (Directory.Exists(_root)) Directory.Delete(_root, true); }

    private sealed class Registry : IMcpResourceRegistry
    {
        public McpResourceDto Resource { get; set; } = new() { ResourceId = Guid.NewGuid(), Id = "example", Command = "npx", Args = ["-y", "example@1.2.3", "--stdio"], Revision = 1, Enabled = true };
        public ToolMcpServerSnapshotDto Snapshot => new() { ResourceId = Resource.ResourceId, Id = Resource.Id, Command = Resource.Command, Args = Resource.Args, Revision = Resource.Revision };
        public Task<McpResourceDto?> GetAsync(Guid id, CancellationToken ct = default) => Task.FromResult<McpResourceDto?>(id == Resource.ResourceId ? Resource : null);
        public Task<IReadOnlyList<McpResourceDto>> ListAsync(Guid? project, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<McpResourceDto>>([Resource]);
        public Task<McpResourceCatalogSnapshot> CaptureAsync(Guid? project, CancellationToken ct = default) => Task.FromResult(new McpResourceCatalogSnapshot([Resource], [Snapshot]));
        public Task<IReadOnlyList<ToolMcpServerSnapshotDto>> ResolveAsync(Guid? project, IReadOnlyList<Guid>? ids, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<ToolMcpServerSnapshotDto>>([Snapshot]);
        public Task EnsureImportedAsync(Guid? project, CancellationToken ct = default) => Task.CompletedTask;
        public Task<McpResourceDto> SaveAsync(Guid? id, McpResourceWriteDto dto, long revision, CancellationToken ct = default) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id, long revision, CancellationToken ct = default) => throw new NotSupportedException();
    }
    private sealed class Installer : IToolProvider
    {
        public int Calls { get; private set; } public bool WasApproved { get; private set; }
        public async Task<ToolWireResponseDto> CallAsync(string root, ToolWireRequestDto request, TimeSpan? timeout = null, CancellationToken ct = default)
        {
            Calls++; WasApproved = request.Approved; Assert.Equal("#managed_mcp_program", request.ToolId);
            var package = request.Params!.Value.GetProperty("package_root").GetString()!;
            Directory.CreateDirectory(package); var entry = Path.Combine(package, "server.js"); await File.WriteAllTextAsync(entry, "retained program", ct);
            return new() { IsSuccess = true, Result = JsonSerializer.SerializeToElement(new { success = true, launch_command = "node", launch_arguments = new[] { entry, "--stdio" } }) };
        }
        public Task<ToolManifestDto> EnsureStartedAsync(string root, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<ToolManifestDto> GetManifestAsync(string root, CancellationToken ct = default) => throw new NotSupportedException();
        public Task ShutdownAsync(CancellationToken ct = default) => Task.CompletedTask;
    }
}
