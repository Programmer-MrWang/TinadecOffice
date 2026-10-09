using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;
using Tomlyn;
using Tomlyn.Model;

namespace TinadecCore.Runtime;

public static class StorageHostBootstrap
{
    public static StorageScopeDescriptor Configure(ConfigurationManager configuration)
    {
        var scope = StorageScopePaths.User(configuration["TinadecStorage:UserRoot"]);
        StorageScopeInitializer.EnsureUser(scope);
        var storageIdentity = UserStorageIdentity.ReadOrCreate(scope);
        var file = Path.Combine(scope.Config, "storage.toml");
        ScopeConfigurationInitialization.Ensure(scope, "storage", () => "version = 1\n[storage]\nbackend = \"sqlite\"\n# PostgreSQL uses a credential reference bound in the user security store.\n");
        var model = TomlSerializer.Deserialize<TomlTable>(File.ReadAllText(file))!;
        var storage = StorageScopeInitializer.Value(model, "storage") as TomlTable ?? throw new InvalidDataException("storage.toml requires [storage].");
        var backend = StorageScopeInitializer.ValidateBackend(StorageScopeInitializer.Value(storage, "backend")?.ToString() ?? "sqlite");
        var reference = StorageScopeInitializer.Value(storage, "postgres_connection_reference")?.ToString();
        var values = new Dictionary<string, string?>
        {
            ["TinadecPersistence:DataRoot"] = scope.Data,
            ["TinadecPersistence:Sqlite:DatabasePath"] = Path.Combine(scope.Data, "tinadec.db"),
            ["TinadecPersistence:Provider"] = backend == "sqlite" ? "Sqlite" : "PostgreSql",
            ["TinadecPersistence:PostgreSql:Schema"] = "tinadec_" + storageIdentity.ToString("N"),
            ["TinadecAgent:ProfileConfigPath"] = Path.Combine(scope.Config, "runtime.toml"),
            ["TinadecTools:DefaultWorkspaceRoot"] = configuration["TinadecTools:DefaultWorkspaceRoot"]
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "TinadecProjects")
        };
        Directory.CreateDirectory(values["TinadecTools:DefaultWorkspaceRoot"]!);
        if (backend == "postgresql")
        {
            if (reference is null) throw new InvalidOperationException("storage.toml requires postgres_connection_reference; bind it in the user security store first.");
            var paths = new StoragePaths(scope.Root, Options.Create(new TinadecPersistenceOptions { DataRoot = scope.Data }), scope);
            var secret = SecretStoreFactory.Resolve(configuration["TinadecPersistence:SecretStore"], paths).GetAsync(reference).GetAwaiter().GetResult()
                ?? throw new InvalidOperationException("The PostgreSQL credential reference is not bound on this machine.");
            values["ConnectionStrings:TinadecStorage"] = secret;
            values["TinadecPersistence:PostgreSql:ConnectionStringName"] = "TinadecStorage";
        }
        configuration.AddInMemoryCollection(values);
        return scope with { Backend = backend, PostgresConnectionReference = reference };
    }
}
