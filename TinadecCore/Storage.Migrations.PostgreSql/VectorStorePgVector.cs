using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using TinadecCore.Lifecycle;

namespace TinadecCore.Storage.Migrations.PostgreSql;

[DbContext(typeof(LifecycleDbContext))]
[Migration("202608260001_VectorStorePgVector")]
public sealed class VectorStorePgVector : Migration
{
    protected override void Up(MigrationBuilder m) => m.Sql("""
        create extension if not exists vector with schema public;

        -- Extensions belong to the database, while all domain tables belong to the scope.
        -- Respect an existing installation's namespace without moving its resources.
        do $vector$ declare vector_schema text; begin
        select n.nspname into strict vector_schema from pg_extension e
            join pg_namespace n on n.oid = e.extnamespace where e.extname = 'vector';
        execute format($ddl$ create table if not exists vector_chunks (
            id bigserial primary key,
            tenant_id uuid not null,
            workspace_id uuid null,
            project_id uuid not null,
            namespace text not null,
            source_type text not null,
            source_id text not null,
            source_revision text not null,
            chunk_index integer not null,
            content_hash text not null,
            content text not null,
            model_id text not null,
            metadata_json text not null,
            created_at timestamptz not null,
            embedding %I.vector not null,
            unique nulls not distinct (tenant_id, workspace_id, project_id, namespace, source_type, source_id, source_revision, chunk_index, model_id)
        ) $ddl$, vector_schema);
        end $vector$;

        create table if not exists vector_collections (
            model_id text primary key,
            dimension integer not null
        );

        create index if not exists ix_vector_chunks_scope on vector_chunks(tenant_id, workspace_id, project_id, namespace, model_id);
        create index if not exists ix_vector_chunks_project_source on vector_chunks(tenant_id, workspace_id, project_id, namespace, source_type, source_id);
        do $vector$ declare vector_schema text; begin
            select n.nspname into strict vector_schema from pg_extension e
                join pg_namespace n on n.oid = e.extnamespace where e.extname = 'vector';
            begin
                execute format('create index if not exists ix_vector_chunks_embedding_hnsw on vector_chunks using hnsw (embedding %I.vector_cosine_ops)', vector_schema);
            exception when others then
                begin
                    execute format('create index if not exists ix_vector_chunks_embedding_ivfflat on vector_chunks using ivfflat (embedding %I.vector_cosine_ops) with (lists = 100)', vector_schema);
                exception when others then
                    raise notice 'vector index creation skipped: %', sqlerrm;
                end;
            end;
        end $vector$;
        """);

    protected override void Down(MigrationBuilder m) => m.Sql("""
        drop index if exists ix_vector_chunks_embedding_hnsw;
        drop index if exists ix_vector_chunks_embedding_ivfflat;
        drop index if exists ix_vector_chunks_project_source;
        drop index if exists ix_vector_chunks_scope;
        drop table if exists vector_collections;
        drop table if exists vector_chunks;
        """);
}
