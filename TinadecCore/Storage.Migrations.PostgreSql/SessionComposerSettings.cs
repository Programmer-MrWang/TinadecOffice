using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TinadecCore.Memory;

namespace TinadecCore.Storage.Migrations.PostgreSql;

[DbContext(typeof(MemoryDbContext))]
[Migration("202610070001_SessionComposerSettings")]
public sealed class SessionComposerSettings : Migration
{
    protected override void Up(MigrationBuilder m) => m.Sql("""
        alter table sessions add column if not exists permission_mode text null;
        alter table sessions add column if not exists space_options_json text null;
        alter table sessions add column if not exists settings_revision bigint not null default 0;
        """);

    protected override void Down(MigrationBuilder m) { }
}
