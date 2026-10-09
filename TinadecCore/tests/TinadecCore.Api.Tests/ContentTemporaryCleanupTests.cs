using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;

namespace TinadecCore.Api.Tests;

public sealed class ContentTemporaryCleanupTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task FailedOrCancelledInputRemovesTheActuallyWrittenTemporaryFile(bool cancellation)
    {
        var root = Path.Combine(Path.GetTempPath(), "tinadec-content-cleanup", Guid.NewGuid().ToString("N"));
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["TinadecPersistence:DataRoot"] = Path.Combine(root, "data") }).Build();
        await using var services = new ServiceCollection().AddTinadecPersistence(config, root).BuildServiceProvider();
        try
        {
            var content = services.GetRequiredService<IContentStore>();
            using var input = new FailingInput(cancellation);
            var request = new ContentWriteRequest(Guid.NewGuid(), Guid.NewGuid(), "failed-input", "application/octet-stream", input);
            if (cancellation) await Assert.ThrowsAnyAsync<OperationCanceledException>(() => content.PutAsync(request));
            else await Assert.ThrowsAsync<IOException>(() => content.PutAsync(request));
            Assert.True(input.FirstChunkRead);
            Assert.Empty(Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories));
            Assert.Equal(0, services.GetRequiredService<IContentLeaseRegistry>().Count);
        }
        finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }
    private sealed class FailingInput(bool cancellation) : MemoryStream
    {
        public bool FirstChunkRead { get; private set; }
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default)
        {
            if (!FirstChunkRead) { FirstChunkRead = true; buffer.Span[0] = 42; return ValueTask.FromResult(1); }
            return ValueTask.FromException<int>(cancellation ? new OperationCanceledException("test input cancellation") : new IOException("test input failure"));
        }
    }
}
