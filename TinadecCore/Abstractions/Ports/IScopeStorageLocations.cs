namespace TinadecCore.Abstractions.Ports;

/// <summary>Immutable locations belonging to one mounted storage scope. Resolving a location never creates it.</summary>
public interface IScopeStorageLocations
{
    string StorageId { get; }
    string Root { get; }
    string Config { get; }
    string Skills { get; }
    string Packages { get; }
    string Data { get; }
    string State { get; }
    string Logs { get; }
    string Cache { get; }
    string Temp { get; }
    string Worktrees { get; }
    string? ProjectRoot { get; }
    bool External { get; }
}

/// <summary>A host-granted ceiling. Project configuration cannot grant access to its own runtime storage.</summary>
public interface IProjectStorageWritePolicy
{
    bool AllowStorageWrite { get; }
}

/// <summary>Host registry roots that the current scope cannot access through Agent tools.</summary>
public interface IProtectedStorageRoots
{
    IReadOnlyList<string> Roots { get; }
}

public sealed record StorageScopeDescriptor(
    string StorageId,
    string ScopeKind,
    string Root,
    string? ProjectRoot = null,
    Guid? ProjectId = null,
    string Backend = "sqlite",
    bool External = false,
    string? PostgresConnectionReference = null) : IScopeStorageLocations
{
    public string Config => Path.Combine(Root, "config");
    public string Skills => Path.Combine(Root, "skills");
    public string Packages => Path.Combine(Root, "packages");
    public string Data => Path.Combine(Root, "data");
    public string State => Path.Combine(Root, "state");
    public string Logs => Path.Combine(Root, "logs");
    public string Cache => Path.Combine(Root, "cache");
    public string Temp => Path.Combine(Root, "temp");
    public string Worktrees => Path.Combine(Root, "worktrees");
    public IEnumerable<(string Category, string Path)> Categories =>
    [ ("config", Config), ("skills", Skills), ("packages", Packages), ("data", Data),
      ("state", State), ("logs", Logs), ("cache", Cache), ("temp", Temp), ("worktrees", Worktrees) ];
}
