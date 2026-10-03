using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.DmaEA.CliRuntime.Acp;

namespace TinadecCore.Api.Tests;

/// <summary>
/// Proves the ACP layer is reachable through the real container rather than only constructed by hand:
/// the module registrar's registrations, the <c>Acp</c> configuration section, and the scratch root
/// resolved against the host's own data root.
/// </summary>
public sealed class AcpHostRegistrationTests : IAsyncLifetime
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "tinadec-acp-registration", Guid.NewGuid().ToString("N"));
    private WebApplicationFactory<Program>? _factory;

    public Task InitializeAsync()
    {
        Directory.CreateDirectory(_root);
        _factory = new Factory(_root);
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _factory?.Dispose();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (Directory.Exists(_root)) Directory.Delete(_root, true);
        return Task.CompletedTask;
    }

    [Fact]
    public void HostRoutersAndOptions_AreRegisteredThroughTheModuleRegistrar()
    {
        var services = _factory!.Services;

        var host = services.GetRequiredService<IAcpSessionHost>();
        var options = services.GetRequiredService<AcpSessionOptions>();
        var routers = services.GetRequiredService<IAcpInteractionRouterFactory>();

        Assert.IsType<AcpSessionHost>(host);
        // Process-wide singleton: sessions are cached per provider instance and the host owns
        // teardown, so a second resolution must not create a second set of process owners.
        Assert.Same(host, services.GetRequiredService<IAcpSessionHost>());
        Assert.Equal(TimeSpan.FromSeconds(90), options.TurnIdleTimeout);
        Assert.Equal("9.9.9", options.ClientVersion);
        Assert.NotSame(routers.Create("session-a"), routers.Create("session-b"));
    }

    [Fact]
    public void UnsetAcpKeys_KeepTheMeasuredDefaults_RatherThanCollapsingToZero()
    {
        var options = _factory!.Services.GetRequiredService<AcpSessionOptions>();

        // Only TurnIdleTimeoutSeconds and ClientVersion are configured in this fixture. Everything
        // else has to come through at its measured value: a hard ceiling that silently became a
        // default timeout would cancel long harness turns.
        Assert.Equal(AcpSessionOptions.Default.PromptHardCeiling, options.PromptHardCeiling);
        Assert.Equal(AcpSessionOptions.Default.DrainQuietWindow, options.DrainQuietWindow);
        Assert.Equal(AcpSessionOptions.Default.CancelGrace, options.CancelGrace);
    }

    [Fact]
    public void ScratchDirectory_IsCreatedUnderTheHostsOwnDataRoot()
    {
        var host = (AcpSessionHost)_factory!.Services.GetRequiredService<IAcpSessionHost>();

        var scratch = host.CreateScratchDirectory(Guid.NewGuid());

        Assert.StartsWith(
            Path.GetFullPath(Path.Combine(_root, "data", "acp-sessions")),
            Path.GetFullPath(scratch),
            StringComparison.Ordinal);
        Assert.True(Directory.Exists(scratch), "the host must create the governed directory, not only name it");
    }

    private sealed class Factory : WebApplicationFactory<Program>
    {
        private readonly string _root;

        public Factory(string root) => _root = root;

        protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["TinadecPersistence:Sqlite:DatabasePath"] = Path.Combine(_root, "tinadec.db"),
            ["TinadecPersistence:DataRoot"] = Path.Combine(_root, "data"),
            ["Acp:TurnIdleTimeoutSeconds"] = "90",
            ["Acp:ClientVersion"] = "9.9.9",
            ["Logging:LogLevel:Default"] = "Warning"
        }));
    }
}
