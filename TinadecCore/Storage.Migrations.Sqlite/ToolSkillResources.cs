using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TinadecCore.Skills;

namespace TinadecCore.Storage.Migrations.Sqlite;

[DbContext(typeof(IntegrationDbContext))]
[Migration("202610080002_ToolSkillResources")]
public sealed class ToolSkillResources : Migration
{
    protected override void Up(MigrationBuilder m) => m.Sql("""
        create table tool_skill_resources (id text primary key, tenant_id text not null, workspace_id text not null,
          name text not null, description text not null, enabled integer not null, revision integer not null,
          content_hash text not null, package_reference text not null, updated_at text not null, deleted_at text null);
        create unique index ix_tool_skill_resources_scope_name on tool_skill_resources(tenant_id, workspace_id, name) where deleted_at is null;
        """);
    protected override void Down(MigrationBuilder m) => m.DropTable("tool_skill_resources");
}
