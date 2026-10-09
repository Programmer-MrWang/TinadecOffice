using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.Persistence;

namespace TinadecCore.Runtime;

public sealed record ContentCollectionPreview(string PreviewId, string StorageId, long FileCount, long SizeBytes,
    IReadOnlyList<string> References, DateTimeOffset ExpiresAt);

/// <summary>Explicit mark and sweep of content-addressed bodies. Owned facts and archives are roots, not cache.</summary>
public sealed class ContentCollectionService(IStorageScopeRegistry registry)
{
    private readonly ConcurrentDictionary<string, Pending> _previews = new();
    public async Task<ContentCollectionPreview> PreviewAsync(string storageId, CancellationToken ct)
    {
        await using var lease = await registry.AcquireExclusiveAsync(storageId, ct).ConfigureAwait(false);
        using var contentLease = lease.Services.GetRequiredService<TinadecCore.Abstractions.Ports.IContentLeaseRegistry>().AcquireMaintenance();
        await StorageMaintenanceService.RequireIdleAsync(lease.Services, ct).ConfigureAwait(false);
        var files = await UnreachableAsync(lease, ct).ConfigureAwait(false);
        var paths = lease.Services.GetRequiredService<StoragePaths>();
        var preview = new ContentCollectionPreview(Guid.NewGuid().ToString("N"), storageId, files.Count, files.Sum(x => x.Length),
            files.Select(x => Path.GetRelativePath(paths.Root, x.FullName).Replace('\\', '/')).ToArray(), DateTimeOffset.UtcNow.AddMinutes(5));
        _previews[preview.PreviewId] = new(preview, Fingerprint(files));
        return preview;
    }
    public async Task<ContentCollectionPreview> ApplyAsync(string storageId, string previewId, CancellationToken ct)
    {
        if (!_previews.TryRemove(previewId, out var pending) || pending.Preview.StorageId != storageId || pending.Preview.ExpiresAt < DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Content collection preview is absent, expired or belongs to another scope.");
        await using var lease = await registry.AcquireExclusiveAsync(storageId, ct).ConfigureAwait(false);
        using var contentLease = lease.Services.GetRequiredService<TinadecCore.Abstractions.Ports.IContentLeaseRegistry>().AcquireMaintenance();
        await StorageMaintenanceService.RequireIdleAsync(lease.Services, ct).ConfigureAwait(false);
        var files = await UnreachableAsync(lease, ct).ConfigureAwait(false);
        if (Fingerprint(files) != pending.Fingerprint) throw new InvalidOperationException("Content references changed after the preview; refresh it before collecting.");
        foreach (var file in files)
        {
            ct.ThrowIfCancellationRequested(); StorageScopePaths.RejectLinks(lease.Descriptor.Root, file.FullName); File.Delete(file.FullName);
        }
        return pending.Preview;
    }
    private static async Task<List<FileInfo>> UnreachableAsync(StorageRuntimeLease lease, CancellationToken ct)
    {
        var paths = lease.Services.GetRequiredService<StoragePaths>();
        var live = new HashSet<string>(await ScopeSessionDataGraph.ReadContentReferencesAsync(lease.Services, ct).ConfigureAwait(false), StringComparer.Ordinal);
        // Frozen manifests, transfer and purge journals, and event payloads remain history roots.
        foreach (var category in new[] { lease.Descriptor.Config, lease.Descriptor.State, Path.Combine(paths.Root, "events"), Path.Combine(paths.Root, "transfers") })
            foreach (var file in StorageMaintenanceService.OwnedFiles(lease.Descriptor.Root, category, ct))
                if (!file.Name.EndsWith(".lock", StringComparison.OrdinalIgnoreCase))
                    foreach (var reference in await ReferencesInFileAsync(file.FullName, ct).ConfigureAwait(false)) live.Add(reference);
        var pending = new Queue<string>(live); var visited = new HashSet<string>(StringComparer.Ordinal);
        while (pending.TryDequeue(out var reference))
        {
            if (!visited.Add(reference)) continue;
            var file = paths.ResolveContentReference(reference);
            if (!File.Exists(file)) throw new InvalidDataException("A persistent content reference is missing: " + reference);
            StorageScopePaths.RejectLinks(paths.Root, file);
            foreach (var nested in await ReferencesInFileAsync(file, ct).ConfigureAwait(false)) if (live.Add(nested)) pending.Enqueue(nested);
        }
        return StorageMaintenanceService.OwnedFiles(paths.Root, Path.Combine(paths.Root, "content"), ct)
            .Where(x => x.Name.Length == 64 && x.Name.All(Uri.IsHexDigit)
                && !live.Contains(Path.GetRelativePath(paths.Root, x.FullName).Replace('\\', '/'))).ToList();
    }
    private static async Task<IReadOnlyList<string>> ReferencesInFileAsync(string file, CancellationToken ct)
    {
        var results = new HashSet<string>(StringComparer.Ordinal);
        using var reader = new StreamReader(new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete));
        var buffer = new char[65536]; var carry = "";
        while (true)
        {
            var count = await reader.ReadAsync(buffer.AsMemory(), ct).ConfigureAwait(false); if (count == 0) break;
            var text = carry + new string(buffer, 0, count);
            foreach (var reference in ScopeSessionDataGraph.FindContentReferences(text)) results.Add(reference);
            carry = text[^Math.Min(1024, text.Length)..];
        }
        return results.ToArray();
    }
    private static string Fingerprint(IEnumerable<FileInfo> files) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
        string.Join('\n', files.OrderBy(x => x.FullName).Select(x => x.FullName + "\0" + x.Length + "\0" + x.LastWriteTimeUtc.Ticks)))));
    private sealed record Pending(ContentCollectionPreview Preview, string Fingerprint);
}
