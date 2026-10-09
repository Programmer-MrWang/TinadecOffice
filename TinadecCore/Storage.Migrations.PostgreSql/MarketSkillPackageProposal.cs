using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TinadecCore.Skills;

namespace TinadecCore.Storage.Migrations.PostgreSql;
[DbContext(typeof(IntegrationDbContext))]
[Migration("202610090002_MarketSkillPackageProposal")]
public sealed class MarketSkillPackageProposal : Migration
{
    protected override void Up(MigrationBuilder m)
    {
        m.Sql("""
            CREATE TABLE IF NOT EXISTS market_install_proposals (
            id uuid PRIMARY KEY, tenant_id uuid NOT NULL, workspace_id uuid NOT NULL, project_id uuid NOT NULL,
            principal_id uuid NOT NULL, action varchar(32) NOT NULL, catalog_id uuid NULL, source_id uuid NULL, installation_id uuid NULL,
            extension_id varchar(256) NOT NULL, version varchar(128) NOT NULL, kind varchar(64) NOT NULL, server_id varchar(128) NOT NULL,
            command varchar(256) NULL, args_json varchar(4096) NOT NULL, environment_json varchar(8192) NOT NULL, replaces_command text NULL,
            target_path varchar(2048) NOT NULL, content varchar(65536) NOT NULL, expected_file_hash varchar(128) NULL, manifest_hash varchar(128) NULL,
            digest varchar(128) NOT NULL, status varchar(32) NOT NULL, user_tool_action_id uuid NULL, created_at timestamptz NOT NULL,
            expires_at timestamptz NOT NULL, consumed_at timestamptz NULL);
            """);
        m.AddColumn<string>("scope", "market_install_proposals", type: "character varying(16)", maxLength: 16, nullable: false, defaultValue: "project");
        m.AddColumn<string>("package_files_json", "market_install_proposals", type: "character varying(65536)", maxLength: 65536, nullable: true);
        m.AddColumn<string>("package_hash", "market_install_proposals", type: "character varying(128)", maxLength: 128, nullable: true);
        m.AddColumn<Guid>("resource_id", "market_install_proposals", nullable: true);
    }
    protected override void Down(MigrationBuilder m)
    {
        m.DropColumn("scope", "market_install_proposals"); m.DropColumn("package_files_json", "market_install_proposals"); m.DropColumn("package_hash", "market_install_proposals"); m.DropColumn("resource_id", "market_install_proposals");
    }
}
