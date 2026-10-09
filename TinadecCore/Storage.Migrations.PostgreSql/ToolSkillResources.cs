using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TinadecCore.Skills;

namespace TinadecCore.Storage.Migrations.PostgreSql;

[DbContext(typeof(IntegrationDbContext))]
[Migration("202610080002_ToolSkillResources")]
public sealed class ToolSkillResources : Migration
{
    protected override void Up(MigrationBuilder m) => m.Sql("""
        create table tool_skill_resources (id uuid primary key, tenant_id uuid not null, workspace_id uuid not null,
          name varchar(64) not null, description varchar(1024) not null, enabled boolean not null, revision bigint not null,
          content_hash varchar(128) not null, package_reference varchar(2048) not null, updated_at timestamptz not null, deleted_at timestamptz null);
        create unique index ix_tool_skill_resources_scope_name on tool_skill_resources(tenant_id, workspace_id, name) where deleted_at is null;
        """);
    protected override void Down(MigrationBuilder m) => m.DropTable("tool_skill_resources");
}
