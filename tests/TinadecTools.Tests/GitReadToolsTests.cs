using TinadecTools.Abstractions;
using TinadecTools.Tools.FileRW;
using TinadecTools.Tools.Git;

namespace TinadecTools.Tests;

public sealed class GitReadToolsTests
{
    [Fact]
    public async Task ReadTools_ReturnStructuredStatusDiffRefsAndRevisionFile()
    {
        using var repo = new TempGitRepo("git-read");
        repo.SeedInitialCommit("note.txt", "initial\n");
        File.WriteAllText(System.IO.Path.Combine(repo.Path, "note.txt"), "changed\n");
        var status = await GitReadTools.StatusAsync(new GitStatusArgs { RepositoryPath = repo.Path }, CancellationToken.None);
        var diff = await GitReadTools.DiffAsync(new GitDiffArgs { RepositoryPath = repo.Path, Target = "working_tree" }, CancellationToken.None);
        var refs = await GitReadTools.RefListAsync(new GitRefListArgs { RepositoryPath = repo.Path }, CancellationToken.None);
        var file = await GitReadTools.FileAtRevisionAsync(new GitFileAtRevisionArgs { RepositoryPath = repo.Path, Path = "note.txt", Rev = "HEAD" }, CancellationToken.None);

        Assert.True(status.Success);
        Assert.True(status.HasUncommittedChanges);
        Assert.Contains(status.Files, item => item.Path == "note.txt");
        Assert.True(diff.Success);
        Assert.Contains("-initial", Assert.Single(diff.Sections).Diff);
        Assert.True(refs.Success);
        Assert.Contains(refs.Refs, item => item.Name == "main" && item.Type == "branch");
        Assert.True(file.Success);
        Assert.Equal("initial\n", file.Content);
    }

    [Fact]
    public async Task Status_ReturnsNonAsciiPathsVerbatim()
    {
        using var repo = new TempGitRepo("git-read");
        repo.SeedInitialCommit("中文文件.txt", "initial\n");
        File.WriteAllText(System.IO.Path.Combine(repo.Path, "中文文件.txt"), "changed\n");
        File.WriteAllText(System.IO.Path.Combine(repo.Path, "新增 未跟踪.md"), "new\n");

        var status = await GitReadTools.StatusAsync(new GitStatusArgs { RepositoryPath = repo.Path }, CancellationToken.None);

        Assert.True(status.Success);
        Assert.Contains(status.Files, entry => entry.Path == "中文文件.txt");
        Assert.Contains(status.Files, entry => entry.Path == "新增 未跟踪.md");
        Assert.DoesNotContain(status.Files, entry => entry.Path.Contains('\\'));
    }

    [Fact]
    public async Task Status_SplitsRenameIntoPathAndPreviousPath()
    {
        using var repo = new TempGitRepo("git-read");
        repo.SeedInitialCommit("old.txt", "content\n");
        repo.RunGit("mv", "old.txt", "重命名 后.txt");

        var status = await GitReadTools.StatusAsync(new GitStatusArgs { RepositoryPath = repo.Path }, CancellationToken.None);

        var renamed = Assert.Single(status.Files, entry => entry.Path == "重命名 后.txt");
        Assert.Equal("old.txt", renamed.PreviousPath);
        Assert.Equal("staged_renamed", renamed.Status);
    }

    [Fact]
    public void ParseStatus_TakesTheRenameSourceFromTheNextRecordNotFromAnArrow()
    {
        var status = GitReadTools.ParseStatus("/repo", "## main...origin/main [ahead 1]\0?? a -> b.txt\0R  新名字.txt\0old.txt\0");

        Assert.True(status.Success);
        Assert.Equal("main", status.Branch);
        Assert.Equal("origin/main", status.Upstream);
        Assert.Equal(1, status.Ahead);
        Assert.Equal(2, status.Files.Count);

        var arrow = Assert.Single(status.Files, entry => entry.Path == "a -> b.txt");
        Assert.Null(arrow.PreviousPath);
        Assert.Equal("untracked", arrow.Status);

        var renamed = Assert.Single(status.Files, entry => entry.Path == "新名字.txt");
        Assert.Equal("old.txt", renamed.PreviousPath);
        Assert.Equal("staged_renamed", renamed.Status);
    }

    [Fact]
    public async Task ReadTools_RejectLinkTraversalAndOptionLikeRevisions()
    {
        using var repo = new TempGitRepo("git-read");
        repo.SeedInitialCommit("note.txt", "initial\n");
        var external = System.IO.Path.Combine(FileToolRuntime.WorkspaceRoot, ".tinadec-tools-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(external);
        try
        {
            File.WriteAllText(System.IO.Path.Combine(external, "outside.txt"), "outside");
            if (!LinkPrerequisite.TryCreateDirectoryLink(System.IO.Path.Combine(repo.Path, "outside"), external)) return;
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => GitReadTools.FileAtRevisionAsync(new GitFileAtRevisionArgs { RepositoryPath = repo.Path, Path = "outside/outside.txt" }, CancellationToken.None).AsTask());
            await Assert.ThrowsAsync<InvalidOperationException>(() => GitReadTools.FileAtRevisionAsync(new GitFileAtRevisionArgs { RepositoryPath = repo.Path, Path = "note.txt", Rev = "--output" }, CancellationToken.None).AsTask());
        }
        finally
        {
            try { if (Directory.Exists(external)) Directory.Delete(external, recursive: true); } catch { }
        }
    }

    [Fact]
    public void GeneratedRegistry_PublishesGitReadToolsWithoutApproval()
    {
        GeneratedToolRegistry.RegisterAll();
        var tools = ToolRegistry.ListTools().ToDictionary(tool => tool.Id, StringComparer.OrdinalIgnoreCase);
        foreach (var toolId in new[] { "git_status", "git_push_readiness", "git_diff", "git_branch_list", "git_worktree_list", "git_ref_list", "git_remote_list", "git_blame", "git_file_at_revision", "git_conflict_preview", "git_log" })
        {
            var descriptor = tools[toolId];
            Assert.False(descriptor.RequiresApproval);
            Assert.False(descriptor.MutatesWorkspace);
            Assert.Equal("safe", descriptor.RetrySafety);
        }
    }

    [Fact]
    public async Task Blame_ReturnsLineAuthorAndContent()
    {
        using var repo = new TempGitRepo("git-read");
        repo.SeedInitialCommit("a.txt", "line1\nline2\n");
        repo.CommitFile("a.txt", "line1\nline2\nline3\n", "add line3");
        var blame = await GitReadTools.BlameAsync(new GitBlameArgs { RepositoryPath = repo, Path = "a.txt" }, CancellationToken.None);
        Assert.True(blame.Success, blame.Error);
        Assert.Equal(3, blame.Lines.Count);
        Assert.All(blame.Lines, line => Assert.False(string.IsNullOrEmpty(line.Commit)));
        Assert.Equal("line3", blame.Lines[2].Content);
    }

    [Fact]
    public async Task RemoteList_ReturnsConfiguredRemoteFetchUrl()
    {
        using var repo = new TempGitRepo("git-read");
        repo.SeedInitialCommit();
        var bareDir = NewBareRepo("git-read-bare");
        repo.RunGit("remote", "add", "origin", bareDir);
        var list = await GitReadTools.RemoteListAsync(new GitRemoteListArgs { RepositoryPath = repo }, CancellationToken.None);
        Assert.True(list.Success, list.Error);
        Assert.Contains(list.Remotes, r => r.Name == "origin" && !string.IsNullOrEmpty(r.FetchUrl));
    }

    [Fact]
    public async Task WorktreeList_MarksMainWorktreeAsCurrent()
    {
        using var repo = new TempGitRepo("git-read");
        repo.SeedInitialCommit();
        var list = await GitReadTools.WorktreeListAsync(new GitWorktreeListArgs { RepositoryPath = repo }, CancellationToken.None);
        Assert.True(list.Success, list.Error);
        Assert.True(list.Worktrees.Count >= 1);
        Assert.Contains(list.Worktrees, w => w.IsCurrent && Normalize(w.Path) == Normalize(repo.Path));
    }

    [Fact]
    public async Task PushReadiness_ReportsBlockersForDirtyOrNoUpstream()
    {
        using var repo = new TempGitRepo("git-read");
        repo.SeedInitialCommit("a.txt", "v1\n");
        File.WriteAllText(System.IO.Path.Combine(repo.Path, "a.txt"), "dirty\n");
        var readiness = await GitReadTools.PushReadinessAsync(new GitPushReadinessArgs { RepositoryPath = repo }, CancellationToken.None);
        Assert.True(readiness.Success, readiness.Error);
        Assert.False(readiness.Ready);
        Assert.NotEmpty(readiness.Blockers);
    }

    private static string NewBareRepo(string prefix)
    {
        var dir = System.IO.Path.Combine(FileToolRuntime.WorkspaceRoot, ".tinadec-tools-tests", $"{prefix}-{Guid.NewGuid():N}");
        Directory.CreateDirectory(dir);
        RunGit(dir, "init", "--bare", dir);
        return dir;
    }

    private static void RunGit(string working, params string[] args)
    {
        var psi = new System.Diagnostics.ProcessStartInfo
        {
            FileName = "git",
            WorkingDirectory = working,
            UseShellExecute = false,
            RedirectStandardError = true,
            CreateNoWindow = true
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        using var p = System.Diagnostics.Process.Start(psi)!;
        var stderr = p.StandardError.ReadToEnd();
        p.WaitForExit();
        if (p.ExitCode != 0) throw new InvalidOperationException($"git {string.Join(' ', args)} failed: {stderr}");
    }

    private static string Normalize(string? path) =>
        path is null ? string.Empty : System.IO.Path.TrimEndingDirectorySeparator(path.Replace('/', '\\'));
}
