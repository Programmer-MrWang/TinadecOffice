using System.Text.Json;
using TinadecTools.Runtime;
using TinadecTools.Runtime.Sandbox;

namespace TinadecTools.Tests;

public sealed class SandboxPolicyStoreTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "tinadec-grants-test-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void ApprovedGrantsUseNativeTomlInStateAndDoNotMigrateConfiguration()
    {
        Directory.CreateDirectory(Path.Combine(_root, "config"));
        var legacy = Path.Combine(_root, "config", "sandbox.json"); File.WriteAllText(legacy, "broken legacy input");
        Assert.Empty(SandboxPolicyStore.Load(_root).WritePaths);
        SandboxPolicyStore.Save(new() { ReadPaths = [_root], WritePaths = [_root], EnvironmentVariables = ["MY_TEST_VARIABLE"] }, _root);
        var path = SandboxPolicyStore.FilePath(_root); var text = File.ReadAllText(path);
        Assert.Equal(Path.Combine(_root, "state", "sandbox-grants.toml"), path);
        Assert.Contains("version = 1", text); Assert.Contains("read_paths = [", text); Assert.DoesNotContain("__tinadec_null", text);
        var loaded = SandboxPolicyStore.Load(_root);
        Assert.Equal([_root], loaded.ReadPaths); Assert.Equal([_root], loaded.WritePaths); Assert.Equal(["MY_TEST_VARIABLE"], loaded.EnvironmentVariables);
        Assert.Equal("broken legacy input", File.ReadAllText(legacy));
        Assert.Empty(Directory.GetFiles(Path.GetDirectoryName(path)!, "*.tmp"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("version = 2\nread_paths = []\nwrite_paths = []\nenvironment_variables = []\n")]
    [InlineData("version = 1\nread_paths = [false]\nwrite_paths = []\nenvironment_variables = []\n")]
    [InlineData("version = 1\nread_paths = [\"relative\"]\nwrite_paths = []\nenvironment_variables = []\n")]
    [InlineData("version = 1\nread_paths = []\nwrite_paths = []\nenvironment_variables = []\nallow_storage_write = true\n")]
    [InlineData("version = 1\nread_paths = []\nwrite_paths = []\nenvironment_variables = [\"TINADEC_HOST_CONTROL_TOKEN\"]\n")]
    [InlineData("version = 1\nread_paths = [\n")]
    public void InvalidGrantHistoryFailsClosedAndKeepsItsAuthoritativeBytes(string text)
    {
        var path = SandboxPolicyStore.FilePath(_root); Directory.CreateDirectory(Path.GetDirectoryName(path)!); File.WriteAllText(path, text);
        Assert.Throws<InvalidDataException>(() => SandboxPolicyStore.Load(_root));
        Assert.Throws<InvalidDataException>(() => SandboxPolicyStore.MergeAndPersist(new(), _root));
        Assert.Equal(text, File.ReadAllText(path));
    }

    [Fact]
    public void OversizedGrantHistoryAndInvalidSaveDoNotProducePartialFiles()
    {
        SandboxPolicyStore.Save(new(), _root); var path = SandboxPolicyStore.FilePath(_root); var original = File.ReadAllBytes(path);
        Assert.Throws<InvalidDataException>(() => SandboxPolicyStore.Save(new() { ReadPaths = ["relative"] }, _root));
        Assert.Equal(original, File.ReadAllBytes(path)); Assert.Empty(Directory.GetFiles(Path.GetDirectoryName(path)!, "*.tmp"));
        File.WriteAllBytes(path, new byte[SandboxPolicyStore.MaxBytes + 1]);
        Assert.Throws<InvalidDataException>(() => SandboxPolicyStore.Load(_root));
    }

    [Fact]
    public async Task ConcurrentGrantUpdatesRetainEveryApprovedAddition()
    {
        await Task.WhenAll(Enumerable.Range(0, 8).Select(index => Task.Run(() => SandboxPolicyStore.MergeAndPersist(
            new() { EnvironmentVariableNames = ["APPROVED_" + index] }, _root))));
        var policy = SandboxPolicyStore.Load(_root);
        Assert.Equal(8, policy.EnvironmentVariables.Count); Assert.Empty(Directory.GetFiles(Path.Combine(_root, "state"), "*.tmp"));
    }

    [Fact]
    public void FrozenGovernedCallsIgnoreLocalStateAndCannotPersistOrResetIt()
    {
        SandboxPolicyStore.Save(new(), _root); var path = SandboxPolicyStore.FilePath(_root); File.WriteAllText(path, "corrupt local grants");
        using var context = ToolExecutionContext.Enter(JsonSerializer.SerializeToElement(new
        {
            schema_version = 1, settings = new { }, allowed_tool_ids = Array.Empty<string>(), storage_id = "test", storage_root = _root,
            project_storage_write = true
        }));
        Assert.Empty(SandboxPolicyStore.Load(_root).WritePaths);
        Assert.Throws<InvalidOperationException>(() => SandboxPolicyStore.Save(new(), _root));
        Assert.Throws<InvalidOperationException>(() => SandboxPolicyStore.MergeAndPersist(new(), _root));
        SandboxPolicyStore.Delete(_root);
        Assert.Equal("corrupt local grants", File.ReadAllText(path));
    }

    [Fact]
    public void PersistentGrantsCannotAuthorizeUserHostStateOrDiskRoot()
    {
        Assert.Throws<UnauthorizedAccessException>(() => SandboxPolicyStore.Save(new() { WritePaths = [Path.GetPathRoot(_root)!] }, _root));
        var userState = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".tinadec", "state");
        Assert.Throws<UnauthorizedAccessException>(() => SandboxPolicyStore.Save(new() { WritePaths = [userState] }, _root));
        Assert.False(File.Exists(SandboxPolicyStore.FilePath(_root)));
    }

    public void Dispose() { if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true); }
}
