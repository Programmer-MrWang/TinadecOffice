using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TinadecCore.Persistence;

namespace TinadecCore.Runtime;

/// <summary>Reopens registered service graphs after host startup without selecting a current project.</summary>
public sealed class StorageScopeRecoveryWorker(IStorageScopeRegistry registry, ILogger<StorageScopeRecoveryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        foreach (var scope in registry.List().Where(scope => scope.ScopeKind == "project"))
        {
            stoppingToken.ThrowIfCancellationRequested();
            var diagnostic = Path.Combine(registry.User.State, "scope-recovery", scope.StorageId + ".toml");
            try
            {
                await using var lease = await registry.AcquireAsync(scope.StorageId, stoppingToken).ConfigureAwait(false);
                if (File.Exists(diagnostic)) File.Delete(diagnostic);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Registered storage scope {StorageId} could not recover; other scopes remain available", scope.StorageId);
                StorageScopePaths.RejectLinks(registry.User.Root, diagnostic);
                await StorageScopeRegistry.AtomicWriteAsync(diagnostic, Tomlyn.TomlSerializer.Serialize(new Tomlyn.Model.TomlTable
                {
                    ["storage_id"] = scope.StorageId, ["storage_root"] = scope.Root,
                    ["error_type"] = ex.GetType().Name, ["reason"] = ex.Message,
                    ["recorded_at"] = DateTimeOffset.UtcNow.ToString("O")
                }), stoppingToken).ConfigureAwait(false);
            }
        }
    }
}
