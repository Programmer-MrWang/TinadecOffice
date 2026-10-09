using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TinadecCore.Tools;
namespace TinadecCore.Storage.Migrations.PostgreSql;
[DbContext(typeof(ToolsSettingsDbContext))]
[Migration("202610080031_ToolConfiguration")]
public sealed class ToolConfiguration : Migration
{
    protected override void Up(MigrationBuilder m) => m.Sql("""
        create table if not exists tool_settings (id uuid NOT NULL PRIMARY KEY,tenant_id uuid NOT NULL,workspace_id uuid NOT NULL,scope_key TEXT NOT NULL,revision bigint NOT NULL,settings_json TEXT NOT NULL,updated_at timestamp with time zone NOT NULL,updated_by_principal_id uuid NOT NULL);
        create table if not exists tool_settings_versions (id uuid NOT NULL PRIMARY KEY,settings_id uuid NOT NULL,revision bigint NOT NULL,settings_json TEXT NOT NULL,created_at timestamp with time zone NOT NULL);
        create table if not exists tool_mcp_resources (id uuid NOT NULL PRIMARY KEY,tenant_id uuid NOT NULL,workspace_id uuid NOT NULL,project_id uuid NULL,scope_key TEXT NOT NULL,server_id TEXT NOT NULL,name TEXT NOT NULL,enabled boolean NOT NULL,command TEXT NOT NULL,args_json TEXT NOT NULL,secret_references_json TEXT NOT NULL,cwd TEXT NULL,revision bigint NOT NULL,configuration_hash TEXT NOT NULL,import_source TEXT NULL,updated_at timestamp with time zone NOT NULL,updated_by_principal_id uuid NOT NULL,deleted_at timestamp with time zone NULL);
        create table if not exists tool_mcp_imports (id uuid NOT NULL PRIMARY KEY,tenant_id uuid NOT NULL,workspace_id uuid NOT NULL,scope_key TEXT NOT NULL,source_path TEXT NOT NULL,content_hash TEXT NOT NULL,error TEXT NULL,imported_at timestamp with time zone NOT NULL);
        create unique index if not exists ix_tool_settings_scope on tool_settings(tenant_id,workspace_id,scope_key);
        create unique index if not exists ix_tool_settings_versions_revision on tool_settings_versions(settings_id,revision);
        create unique index if not exists ix_tool_mcp_resources_scope on tool_mcp_resources(tenant_id,workspace_id,scope_key,server_id);
        create unique index if not exists ix_tool_mcp_imports_scope on tool_mcp_imports(tenant_id,workspace_id,scope_key);
        """);
    protected override void Down(MigrationBuilder m) { }
}

