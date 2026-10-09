using Microsoft.Extensions.Logging;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Runtime;

namespace TinadecCore.Api.Tests;

public sealed class ScopeLoggingTests
{
    [Fact]
    public void CombinedBudgetRotatesAndRemovesOnlyRecognizedClosedLogs()
    {
        var root = Path.Combine(Path.GetTempPath(), "tinadec-log-budget", Guid.NewGuid().ToString("N"));
        var scope = new StorageScopeDescriptor("test", "project", root);
        Directory.CreateDirectory(scope.Config); Directory.CreateDirectory(scope.Logs);
        try
        {
            File.WriteAllText(Path.Combine(scope.Config, "logging.toml"), "version = 1\n[logging]\nrotation_bytes = 4096\ntotal_bytes = 8192\n");
            var rotatedHost = Path.Combine(scope.Logs, "electron.1723456789012-1.log");
            File.WriteAllText(rotatedHost, new string('h', 5000)); File.SetLastWriteTimeUtc(rotatedHost, DateTime.UtcNow.AddHours(-1));
            var diagnostic = Path.Combine(scope.Logs, "user-diagnostic.txt"); File.WriteAllText(diagnostic, "keep");
            using var provider = new ScopeDiagnosticLoggerProvider(scope);
            var logger = provider.CreateLogger("StorageTest");
            for (var i = 0; i < 12; i++) logger.LogInformation("{Message}", new string('a', 1000));
            Assert.False(File.Exists(rotatedHost)); Assert.Equal("keep", File.ReadAllText(diagnostic));
            Assert.All(Directory.GetFiles(scope.Logs).Where(file => Path.GetFileName(file).StartsWith("core.log")),
                file => Assert.InRange(new FileInfo(file).Length, 1, 4096));
            Assert.InRange(Directory.GetFiles(scope.Logs).Sum(file => new FileInfo(file).Length), 1, 8192);
        }
        finally { Directory.Delete(root, true); }
    }
}
