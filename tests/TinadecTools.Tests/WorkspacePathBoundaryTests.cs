using TinadecTools.Tools.FileRW;

namespace TinadecTools.Tests;

/// <summary>
/// Workspace path contract: absolute paths inside the writable root are accepted,
/// relative paths resolve against it, declared read-only roots widen reads only,
/// and an out-of-bounds path is refused with a message that names the attempted
/// path and the allowed roots (the model has to be able to correct itself).
/// </summary>
public sealed class WorkspacePathBoundaryTests : IDisposable
{
    private readonly string _temp = Path.Combine(Path.GetTempPath(), "tinadec-path-" + Guid.NewGuid().ToString("N"));
    private readonly string _writable;
    private readonly string _readOnly;

    public WorkspacePathBoundaryTests()
    {
        _writable = Directory.CreateDirectory(Path.Combine(_temp, "writable")).FullName;
        _readOnly = Directory.CreateDirectory(Path.Combine(_temp, "shared")).FullName;
    }

    public void Dispose()
    {
        try { Directory.Delete(_temp, recursive: true); } catch (IOException) { /* best effort */ }
    }

    private WorkspaceRootSet Roots() => new(WorkspaceRootSet.Normalize(_writable), [WorkspaceRootSet.Normalize(_readOnly)]);

    [Fact]
    public void AbsolutePath_InsideWritableRoot_ResolvesForReadAndWrite()
    {
        var roots = Roots();
        var target = Path.Combine(_writable, "src", "app.ts");

        Assert.Equal(target, roots.Resolve(target, writable: false));
        Assert.Equal(target, roots.Resolve(target, writable: true));
    }

    [Fact]
    public void RelativePath_ResolvesAgainstTheWritableRoot()
    {
        var roots = Roots();
        Assert.Equal(
            Path.Combine(roots.WritableRoot, "src", "app.ts"),
            roots.Resolve(Path.Combine("src", "app.ts"), writable: false));
    }

    [Fact]
    public void ReadOnlyRoot_IsReadableButNeverWritable()
    {
        var roots = Roots();
        var target = Path.Combine(_readOnly, "notes.md");

        Assert.Equal(target, roots.Resolve(target, writable: false));
        Assert.True(roots.IsAllowed(target));

        var refusal = Assert.Throws<UnauthorizedAccessException>(() => roots.Resolve(target, writable: true));
        Assert.Contains(_readOnly, refusal.Message, StringComparison.Ordinal);
        Assert.Contains(roots.WritableRoot, refusal.Message, StringComparison.Ordinal);
        Assert.Contains("may be written", refusal.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void PathOutsideEveryRoot_IsRefusedWithAttemptedPathAndAllowedRoots()
    {
        var roots = Roots();
        var outside = Path.Combine(_temp, "elsewhere", "secret.txt");

        var refusal = Assert.Throws<UnauthorizedAccessException>(() => roots.Resolve(outside, writable: false));
        Assert.Contains(outside, refusal.Message, StringComparison.Ordinal);
        Assert.Contains(roots.WritableRoot, refusal.Message, StringComparison.Ordinal);
        Assert.Contains(_readOnly, refusal.Message, StringComparison.Ordinal);
        Assert.Contains("may be read", refusal.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void OwningRoot_IsTheRootThatContainsThePath()
    {
        var roots = Roots();
        Assert.Equal(roots.WritableRoot, roots.OwningRoot(Path.Combine(_writable, "a", "b")).Root);
        Assert.Equal(Path.Combine("a", "b"), roots.OwningRoot(Path.Combine(_writable, "a", "b")).Relative);
        Assert.Equal(roots.ReadOnlyRoots[0], roots.OwningRoot(Path.Combine(_readOnly, "c")).Root);
    }

    [Fact]
    public void ParseReadOnlyRoots_DropsCoveredEntriesAndSurvivesGarbage()
    {
        var writable = WorkspaceRootSet.Normalize(_writable);
        var nested = Path.Combine(_writable, "nested");
        var raw = string.Join(Path.PathSeparator, writable, nested, _readOnly, "   ");

        var roots = WorkspaceRootSet.ParseReadOnlyRoots(raw, writable);

        var parsed = Assert.Single(roots);
        Assert.Equal(WorkspaceRootSet.Normalize(_readOnly), parsed);
        Assert.Empty(WorkspaceRootSet.ParseReadOnlyRoots(null, writable));
        Assert.Empty(WorkspaceRootSet.ParseReadOnlyRoots("   ", writable));
        Assert.Empty(WorkspaceRootSet.ParseReadOnlyRoots(writable, writable));
    }

    [Fact]
    public void IsWithin_MatchesOnASegmentBoundary()
    {
        var root = WorkspaceRootSet.Normalize(_writable);
        Assert.True(WorkspaceRootSet.IsWithin(root, root));
        Assert.True(WorkspaceRootSet.IsWithin(root, Path.Combine(root, "child")));
        // A sibling that merely shares the prefix text is not inside.
        Assert.False(WorkspaceRootSet.IsWithin(root, root + "-sibling"));
    }
}
