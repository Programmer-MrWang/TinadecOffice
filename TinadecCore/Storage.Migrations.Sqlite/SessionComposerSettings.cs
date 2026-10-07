using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TinadecCore.Memory;

namespace TinadecCore.Storage.Migrations.Sqlite;

[DbContext(typeof(MemoryDbContext))]
[Migration("202610070001_SessionComposerSettings")]
public sealed class SessionComposerSettings : Migration
{
    protected override void Up(MigrationBuilder m) => m.Sql("""
        alter table sessions add column permission_mode text null;
        alter table sessions add column space_options_json text null;
        alter table sessions add column settings_revision integer not null default 0;
        """);

    protected override void Down(MigrationBuilder m) { }
}
