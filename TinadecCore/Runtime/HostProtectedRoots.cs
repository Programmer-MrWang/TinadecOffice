using TinadecCore.Abstractions.Ports;

namespace TinadecCore.Runtime;

/// <summary>Read at run admission so other registrations and host security never become project authority.</summary>
public sealed class HostProtectedRoots(IStorageScopeRegistry registry, string currentStorageId) : IProtectedStorageRoots
{
    public IReadOnlyList<string> Roots => registry.List().Where(x => x.StorageId != currentStorageId).Select(x => x.Root)
        .Concat(currentStorageId == "user" ? [] : registry.User.Categories.Select(category => category.Path))
        .Concat([Path.Combine(registry.User.Root, "security"), registry.User.State,
            Path.Combine(registry.User.Root, "defaults"), Path.Combine(registry.User.Root, "toolchains")])
        .Concat(registry.List().Where(scope => scope.StorageId == currentStorageId && scope.ProjectRoot is not null
            && !StorageScopeInitializer.SamePath(scope.Root, Path.Combine(scope.ProjectRoot, ".tinadec")))
            .Select(scope => Path.Combine(scope.ProjectRoot!, ".tinadec")))
        .Distinct(StringComparer.Ordinal).ToArray();
}
