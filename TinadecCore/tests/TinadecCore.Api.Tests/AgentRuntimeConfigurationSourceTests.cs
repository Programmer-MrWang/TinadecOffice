using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using TinadecCore.Abstractions.Ports;
using TinadecCore.DmaEA;
using TinadecCore.Persistence;

namespace TinadecCore.Api.Tests;

public sealed class AgentRuntimeConfigurationSourceTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "tinadec-runtime-source-tests", Guid.NewGuid().ToString("N"));

    [Theory]
    [InlineData(null)]
    [InlineData("false")]
    public void EmbeddedLocationsWithoutEditingAuthorityUsePackagedOrExplicitBaseline(string? enabled)
    {
        var scope = new StorageScopeDescriptor("user", "user", Path.Combine(_root, "declared-only"));
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["TinadecStorage:Enabled"] = enabled }).Build();
        using (var services = Build(configuration, scope))
        {
            var runtime = services.GetRequiredService<AgentRuntimeConfigurationStore>();
            Assert.Equal(PackagedBaseline, runtime.Diagnostic.SourcePath);
            Assert.NotEmpty(runtime.Current.ContentHash);
        }
        Directory.CreateDirectory(_root);
        var explicitProfile = Path.Combine(_root, "explicit-profile.toml"); File.Copy(PackagedBaseline, explicitProfile);
        configuration["TinadecAgent:ProfileConfigPath"] = explicitProfile;
        using (var services = Build(configuration, scope))
            Assert.Equal(explicitProfile, services.GetRequiredService<AgentRuntimeConfigurationStore>().Diagnostic.SourcePath);
        Assert.False(Directory.Exists(scope.Root));
    }

    [Fact]
    public void EditingAuthorityRequiresScopeRuntimeAndNeverFallsBackToPackagedOrExplicitProfile()
    {
        var scope = new StorageScopeDescriptor("user", "user", Path.Combine(_root, "managed"));
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["TinadecStorage:Enabled"] = "false", ["TinadecAgent:ProfileConfigPath"] = PackagedBaseline }).Build();
        using var services = Build(configuration, scope, new ScopeConfigurationDocuments(scope, []));
        var missing = Assert.Throws<FileNotFoundException>(() => services.GetRequiredService<AgentRuntimeConfigurationStore>());
        Assert.Equal(Path.Combine(scope.Config, "runtime.toml"), missing.FileName);
        Assert.False(Directory.Exists(scope.Root));
        // Explicit restoration is valid; the host must not create this file implicitly.
        Directory.CreateDirectory(scope.Config); File.Copy(PackagedBaseline, missing.FileName!);
        Assert.Equal(missing.FileName, services.GetRequiredService<AgentRuntimeConfigurationStore>().Diagnostic.SourcePath);
    }

    private static string PackagedBaseline => Path.Combine(AppContext.BaseDirectory, "Configuration", "default-agent-runtime.toml");
    private static ServiceProvider Build(IConfiguration configuration, IScopeStorageLocations scope, IScopeConfigurationDocuments? documents = null)
    {
        var services = new ServiceCollection(); services.AddSingleton(configuration); services.AddSingleton(scope);
        services.AddSingleton<ILogger<AgentRuntimeConfigurationStore>>(NullLogger<AgentRuntimeConfigurationStore>.Instance);
        if (documents is not null) services.AddSingleton(documents);
        services.AddSingleton<AgentRuntimeConfigurationStore>();
        return services.BuildServiceProvider();
    }

    public void Dispose() { if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true); }
}
