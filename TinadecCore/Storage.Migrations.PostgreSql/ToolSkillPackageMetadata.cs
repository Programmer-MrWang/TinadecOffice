using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TinadecCore.Skills;

namespace TinadecCore.Storage.Migrations.PostgreSql;

[DbContext(typeof(IntegrationDbContext))]
[Migration("202610090001_ToolSkillPackageMetadata")]
public sealed class ToolSkillPackageMetadata : Migration
{
    protected override void Up(MigrationBuilder m)
    {
        m.AddColumn<string>("source", "tool_skill_resources", type: "character varying(128)", nullable: false, defaultValue: "manual");
        m.AddColumn<string>("version", "tool_skill_resources", type: "character varying(128)", maxLength: 128, nullable: true);
        m.AddColumn<string>("commit", "tool_skill_resources", type: "character varying(64)", maxLength: 64, nullable: true);
    }

    protected override void Down(MigrationBuilder m)
    {
        m.DropColumn("source", "tool_skill_resources");
        m.DropColumn("version", "tool_skill_resources");
        m.DropColumn("commit", "tool_skill_resources");
    }
}
