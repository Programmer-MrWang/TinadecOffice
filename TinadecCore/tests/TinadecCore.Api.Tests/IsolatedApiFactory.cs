using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace TinadecCore.Api.Tests;

/// <summary>
/// Storage choices must be host settings, visible to Program's first statements.
/// ConfigureAppConfiguration alone is too late to prevent user-scope bootstrap.
/// </summary>
public abstract class IsolatedApiFactory : WebApplicationFactory<Program>
{
    protected virtual bool UsesManagedStorage => false;
    protected virtual string? ManagedUserRoot => null;

    protected sealed override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ApiTestStorage.AssertFallbackIsActive();
        var managedRoot = UsesManagedStorage ? ApiTestStorage.RequireManagedRoot(ManagedUserRoot) : ApiTestStorage.Home;
        builder.UseEnvironment(UsesManagedStorage ? "StorageTesting" : "Testing");
        builder.UseSetting("TinadecStorage:Enabled", UsesManagedStorage ? "true" : "false");
        builder.UseSetting("TinadecStorage:UserRoot", managedRoot);
        builder.UseSetting("TinadecTools:DefaultWorkspaceRoot", Path.Combine(managedRoot, "workspace"));
        ConfigureIsolatedWebHost(builder);
        if (builder.GetSetting("TinadecStorage:Enabled") != (UsesManagedStorage ? "true" : "false")
            || !string.Equals(builder.GetSetting("TinadecStorage:UserRoot"), managedRoot, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal)
            || builder.GetSetting(WebHostDefaults.EnvironmentKey) != (UsesManagedStorage ? "StorageTesting" : "Testing"))
            throw new InvalidOperationException("API test factories cannot override the early storage isolation settings.");
        builder.ConfigureAppConfiguration((context, configuration) =>
        {
            ApiTestStorage.AssertFallbackIsActive();
            var values = configuration.Build();
            var canonicalPaths = new Dictionary<string, string?>();
            try
            {
                if (values.GetValue<bool?>("TinadecStorage:Enabled") != UsesManagedStorage
                    || !string.Equals(context.HostingEnvironment.EnvironmentName, UsesManagedStorage ? "StorageTesting" : "Testing", StringComparison.Ordinal))
                    throw new InvalidOperationException("API test host settings cannot change the early storage isolation decision.");
                if (UsesManagedStorage)
                {
                    var configuredRoot = ApiTestStorage.RequireManagedRoot(values["TinadecStorage:UserRoot"]);
                    if (!string.Equals(configuredRoot, managedRoot, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal))
                        throw new InvalidOperationException("Managed API test UserRoot changed after its early host binding.");
                }
                foreach (var key in new[] { "TinadecPersistence:DataRoot", "TinadecPersistence:Sqlite:DatabasePath", "TinadecTools:DefaultWorkspaceRoot" })
                {
                    if (values[key] is { Length: > 0 } path) canonicalPaths[key] = ApiTestStorage.ValidateTemporaryPath(path);
                }
            }
            finally
            {
                // ConfigurationManager.Build returns the live manager itself.
                // An ordinary builder creates a disposable snapshot with its
                // own file watchers; release only that separate snapshot.
                if (!ReferenceEquals(values, configuration) && values is IDisposable snapshot) snapshot.Dispose();
            }
            // macOS /var temporary roots resolve through /private/var. The
            // production owned-path guard must receive the resolved spelling,
            // not merely have that spelling checked in this test callback.
            if (canonicalPaths.Count > 0) configuration.AddInMemoryCollection(canonicalPaths);
        });
    }

    protected virtual void ConfigureIsolatedWebHost(IWebHostBuilder builder) { }
}
