using System.Text;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;
using Tomlyn;
using Tomlyn.Model;

namespace TinadecCore.Runtime;

/// <summary>Host-owned identity remains stable for one user storage root; it is not editable configuration.</summary>
public static class UserStorageIdentity
{
    public static Guid ReadOrCreate(IScopeStorageLocations scope)
    {
        var path = StorageScopePaths.Contained(scope.State, "storage-identity.toml");
        StorageScopePaths.RejectLinks(scope.Root, path);
        Directory.CreateDirectory(scope.State);
        using var lease = AcquireLease(scope);
        StorageScopePaths.RejectLinks(scope.Root, path);
        if (File.Exists(path)) return Read(scope, path);
        if (File.Exists(Path.Combine(scope.State, ".configuration-documents", "storage.initialized"))
            || File.Exists(Path.Combine(scope.Data, "tinadec.db")))
            throw new ConfigurationDocumentException("storage_identity_missing", "The identity of an established user storage root is missing. Restore its original state file before reopening it.");
        var identity = Guid.NewGuid();
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
            {
                stream.Write(Encoding.UTF8.GetBytes("version = 1\nstorage_identity = \"" + identity.ToString("N") + "\"\n"));
                stream.Flush(flushToDisk: true);
            }
            StorageScopePaths.RejectLinks(scope.Root, path);
            try { File.Move(temporary, path, overwrite: false); }
            catch (IOException) when (File.Exists(path)) { return Read(scope, path); }
            return identity;
        }
        finally
        {
            StorageScopePaths.RejectLinks(scope.Root, temporary);
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    private static FileStream AcquireLease(IScopeStorageLocations scope)
    {
        var path = StorageScopePaths.Contained(scope.State, ".storage-identity.lock");
        for (var attempt = 0; ; attempt++)
        {
            StorageScopePaths.RejectLinks(scope.Root, path);
            try { return new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
            catch (IOException) when (attempt < 400) { Thread.Sleep(10); }
        }
    }

    private static Guid Read(IScopeStorageLocations scope, string path)
    {
        StorageScopePaths.RejectLinks(scope.Root, path);
        if (new FileInfo(path).Length > 4096) throw Invalid();
        try
        {
            var model = TomlSerializer.Deserialize<TomlTable>(File.ReadAllText(path))!;
            if (model.TryGetValue("version", out var version) && version is long revision && revision == 1
                && model.TryGetValue("storage_identity", out var value) && value is string text
                && Guid.TryParseExact(text, "N", out var identity) && identity != Guid.Empty) return identity;
        }
        catch (TomlException) { throw Invalid(); }
        throw Invalid();
    }

    private static ConfigurationDocumentException Invalid() => new("storage_identity_invalid", "The host storage identity is invalid. Restore its original state file before reopening this user root.");
}
