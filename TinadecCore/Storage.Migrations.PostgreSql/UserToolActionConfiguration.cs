using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TinadecCore.Lifecycle;
namespace TinadecCore.Storage.Migrations.PostgreSql;
[DbContext(typeof(LifecycleDbContext))]
[Migration("202610080032_UserToolActionConfiguration")]
public sealed class UserToolActionConfiguration : Migration
{
    protected override void Up(MigrationBuilder m) => m.Sql("""
        alter table user_tool_actions add column tool_configuration_reference text not null default '';
        alter table user_tool_actions add column tool_configuration_hash text not null default '';
        alter table user_tool_actions add column tool_configuration_length bigint not null default 0;
        """);
    protected override void Down(MigrationBuilder m) { }
}
