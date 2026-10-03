using TinadecTools.Runtime;

namespace TinadecTools.Tests;

/// <summary>
/// The tools process cannot reference Core, so the spelling resolver it compares paths with is a
/// copy of <c>WorkspacePathSpelling</c>. These cases pin the two properties the boundary rule leans
/// on: the existing prefix is resolved link by link, and a path that does not exist yet keeps its
/// missing tail.
/// </summary>
public sealed class WorkspacePathFormTests
{
    /// <summary>The host's own volume or POSIX root, so the fixture below spells paths the way
    /// <see cref="Path.GetFullPath(string)"/> will answer them on every platform.</summary>
    private static readonly string Root = Path.GetPathRoot(Path.GetFullPath("."))!;

    private static string At(params string[] segments) => Path.Combine(new[] { Root.TrimEnd(Path.DirectorySeparatorChar) }.Concat(segments).ToArray());

    [Fact]
    public void TheExistingPrefixIsResolvedAndTheMissingTailPutBack()
    {
        // macOS reality, spelled as a fixture so a Windows host runs it too: the first directory is a
        // link, nothing below it is, and the leaf file has not been written yet.
        var link = At("var");
        var target = At("private", "var");
        var exists = new HashSet<string>(StringComparer.Ordinal)
        {
            Root, Root.TrimEnd(Path.DirectorySeparatorChar), link, At("var", "folders"), At("var", "folders", "t7"),
            target, At("private", "var", "folders"), At("private", "var", "folders", "t7"),
        };

        var canonical = WorkspacePathForm.Canonical(
            At("var", "folders", "t7", "ws", "mcp_servers.json"),
            directoryExists: directory => exists.Contains(directory),
            resolveOneLink: part => part == link ? target : null);

        Assert.Equal(At("private", "var", "folders", "t7", "ws", "mcp_servers.json"), canonical);
    }

    [Fact]
    public void CanonicalizingTheRealFileSystemTwiceChangesNothing()
    {
        var directory = Directory.CreateTempSubdirectory("tinadec-form-").FullName;
        try
        {
            var once = WorkspacePathForm.Canonical(Path.Combine(directory, "not", "there.json"));

            Assert.Equal(once, WorkspacePathForm.Canonical(once));
            Assert.StartsWith(WorkspacePathForm.Canonical(directory) + Path.DirectorySeparatorChar, once);
        }
        finally
        {
            try { Directory.Delete(directory, recursive: true); } catch (IOException) { /* best effort */ }
        }
    }

    [Fact]
    public void APathNoDirectoryExistsForFallsBackToItsNormalizedForm()
    {
        var nowhere = At("definitely", "not", "here");

        Assert.Equal(nowhere, WorkspacePathForm.Canonical(nowhere, directoryExists: _ => false));
    }
}
