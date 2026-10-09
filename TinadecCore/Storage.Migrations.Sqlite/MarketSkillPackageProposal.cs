using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TinadecCore.Skills;

namespace TinadecCore.Storage.Migrations.Sqlite;
[DbContext(typeof(IntegrationDbContext))]
[Migration("202610090002_MarketSkillPackageProposal")]
public sealed class MarketSkillPackageProposal : Migration
{
    protected override void Up(MigrationBuilder m)
    {
        // This ledger originally used the model bootstrap, so a fresh database reaches
        // migrations before that bootstrap has created its table.
        m.Sql("""
            CREATE TABLE IF NOT EXISTS market_install_proposals (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, workspace_id TEXT NOT NULL, project_id TEXT NOT NULL,
            principal_id TEXT NOT NULL, action TEXT NOT NULL, catalog_id TEXT NULL, source_id TEXT NULL, installation_id TEXT NULL,
            extension_id TEXT NOT NULL, version TEXT NOT NULL, kind TEXT NOT NULL, server_id TEXT NOT NULL,
            command TEXT NULL, args_json TEXT NOT NULL, environment_json TEXT NOT NULL, replaces_command TEXT NULL,
            target_path TEXT NOT NULL, content TEXT NOT NULL, expected_file_hash TEXT NULL, manifest_hash TEXT NULL,
            digest TEXT NOT NULL, status TEXT NOT NULL, user_tool_action_id TEXT NULL, created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL, consumed_at TEXT NULL);
            """);
        m.AddColumn<string>("scope", "market_install_proposals", maxLength: 16, nullable: false, defaultValue: "project");
        m.AddColumn<string>("package_files_json", "market_install_proposals", maxLength: 65536, nullable: true);
        m.AddColumn<string>("package_hash", "market_install_proposals", maxLength: 128, nullable: true);
        m.AddColumn<string>("resource_id", "market_install_proposals", nullable: true);
    }
    protected override void Down(MigrationBuilder m)
    {
        m.DropColumn("scope", "market_install_proposals"); m.DropColumn("package_files_json", "market_install_proposals"); m.DropColumn("package_hash", "market_install_proposals"); m.DropColumn("resource_id", "market_install_proposals");
    }
}
