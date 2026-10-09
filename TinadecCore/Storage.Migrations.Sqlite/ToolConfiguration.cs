using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TinadecCore.Tools;
namespace TinadecCore.Storage.Migrations.Sqlite;
[DbContext(typeof(ToolsSettingsDbContext))]
[Migration("202610080031_ToolConfiguration")]
public sealed class ToolConfiguration : Migration
{
    protected override void Up(MigrationBuilder m) => m.Sql("""
        create table if not exists tool_settings (id TEXT NOT NULL PRIMARY KEY,tenant_id TEXT NOT NULL,workspace_id TEXT NOT NULL,scope_key TEXT NOT NULL,revision INTEGER NOT NULL,settings_json TEXT NOT NULL,updated_at TEXT NOT NULL,updated_by_principal_id TEXT NOT NULL);
        create table if not exists tool_settings_versions (id TEXT NOT NULL PRIMARY KEY,settings_id TEXT NOT NULL,revision INTEGER NOT NULL,settings_json TEXT NOT NULL,created_at TEXT NOT NULL);
        create table if not exists tool_mcp_resources (id TEXT NOT NULL PRIMARY KEY,tenant_id TEXT NOT NULL,workspace_id TEXT NOT NULL,project_id TEXT NULL,scope_key TEXT NOT NULL,server_id TEXT NOT NULL,name TEXT NOT NULL,enabled INTEGER NOT NULL,command TEXT NOT NULL,args_json TEXT NOT NULL,secret_references_json TEXT NOT NULL,cwd TEXT NULL,revision INTEGER NOT NULL,configuration_hash TEXT NOT NULL,import_source TEXT NULL,updated_at TEXT NOT NULL,updated_by_principal_id TEXT NOT NULL,deleted_at TEXT NULL);
        create table if not exists tool_mcp_imports (id TEXT NOT NULL PRIMARY KEY,tenant_id TEXT NOT NULL,workspace_id TEXT NOT NULL,scope_key TEXT NOT NULL,source_path TEXT NOT NULL,content_hash TEXT NOT NULL,error TEXT NULL,imported_at TEXT NOT NULL);
        create unique index if not exists ix_tool_settings_scope on tool_settings(tenant_id,workspace_id,scope_key);
        create unique index if not exists ix_tool_settings_versions_revision on tool_settings_versions(settings_id,revision);
        create unique index if not exists ix_tool_mcp_resources_scope on tool_mcp_resources(tenant_id,workspace_id,scope_key,server_id);
        create unique index if not exists ix_tool_mcp_imports_scope on tool_mcp_imports(tenant_id,workspace_id,scope_key);
        """);
    protected override void Down(MigrationBuilder m) { }
}

