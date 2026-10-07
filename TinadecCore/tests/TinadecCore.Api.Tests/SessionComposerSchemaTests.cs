using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using TinadecCore.Memory;
using TinadecCore.Persistence;

namespace TinadecCore.Api.Tests;

public sealed class SessionComposerSchemaTests
{
    [Fact]
    public async Task SqliteSettingsColumns_PreserveSessionContentAndUseSpatialDefaults()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<MemoryDbContext>().UseSqlite(connection).Options;
        var id = Guid.NewGuid();
        await using (var db = new MemoryDbContext(options))
        {
            await db.Database.EnsureCreatedAsync();
            db.Sessions.Add(new SessionRecord
            {
                Id = id, TenantId = Guid.NewGuid(), WorkspaceId = Guid.NewGuid(),
                Title = "Existing space", ViewMode = "space", ModeVersionId = Guid.NewGuid(),
                CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
            // Restore the pre-change schema while retaining the user's existing row.
            await db.Database.ExecuteSqlRawAsync("""
                alter table sessions drop column permission_mode;
                alter table sessions drop column space_options_json;
                alter table sessions drop column settings_revision;
                """);
            var migration = new TinadecCore.Storage.Migrations.Sqlite.SessionComposerSettings();
            foreach (var operation in migration.UpOperations.Cast<SqlOperation>())
                await db.Database.ExecuteSqlRawAsync(operation.Sql);
            await DbContextSchemaBootstrapper.EnsureTablesAsync(db);
        }
        await using var upgraded = new MemoryDbContext(options);
        var row = await upgraded.Sessions.SingleAsync(x => x.Id == id);
        Assert.Equal("Existing space", row.Title);
        Assert.Equal("space", row.ViewMode);
        Assert.Null(row.PermissionMode);
        Assert.Null(row.SpaceOptionsJson);
        Assert.Equal(new TinadecCore.Abstractions.Ports.SpaceRunOptions(), ProjectSessionStore.ReadSpaceOptions(row));
        Assert.Equal(0, row.SettingsRevision);
        row.PermissionMode = "ask";
        row.SettingsRevision = 1;
        await upgraded.SaveChangesAsync();
    }
}
