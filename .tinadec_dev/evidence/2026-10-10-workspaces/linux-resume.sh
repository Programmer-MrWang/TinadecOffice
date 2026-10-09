#!/usr/bin/env bash
set -euo pipefail
task_root=${1:?pass the previously owned temporary validation root}
[[ "$task_root" =~ ^/var/tmp/tinadec-workspaces-20261010\.[A-Za-z0-9]+$ && -f "$task_root/postgres/PG_VERSION" ]] || exit 2
source_root=/mnt/c/git/agent/TinadecOffice
evidence="$source_root/.tinadec_dev/evidence/2026-10-10-workspaces"
runtime=/var/tmp/tinadec-storage-validation
export DOTNET_ROOT="$runtime/sdk" PATH="$runtime/sdk:$runtime/bubblewrap/bin:$PATH"
export DOTNET_CLI_HOME="$task_root/dotnet-home" NUGET_PACKAGES="$runtime/nuget"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 DOTNET_gcServer=0 MSBUILDDISABLENODEREUSE=1
cleanup() {
  if [[ -f "$task_root/postgres/postmaster.pid" ]]; then runuser -u postgres -- pg_ctl -D "$task_root/postgres" -m fast stop || true; fi
  cp -a "$task_root/evidence/." "$evidence/"
}
trap cleanup EXIT
runuser -u postgres -- pg_ctl -D "$task_root/postgres" -l "$task_root/postgres/server.log" -o "-h 127.0.0.1 -p 54394 -k $task_root/pg-socket -F" start
export TINADEC_TEST_POSTGRES=1 TINADEC_TEST_POSTGRES_CONNECTION='Host=127.0.0.1;Port=54394;Username=postgres;Database=tinadec_workspace_validation;Pooling=false'
cd "$source_root"
dotnet test TinadecCore/tests/TinadecCore.Api.Tests/TinadecCore.Api.Tests.csproj --artifacts-path "$task_root/artifacts" --no-restore --nologo -m:1 -clp:ErrorsOnly --filter 'FullyQualifiedName~PostgreSqlMultiFolderWorkspaceTests' --logger 'trx;LogFileName=linux-workspace-core.trx' --results-directory "$task_root/evidence" > "$task_root/evidence/linux-workspace-core.log" 2>&1
printf 'Fresh-schema PostgreSQL vector isolation passed\n'
existing_database=$(runuser -u postgres -- psql -h 127.0.0.1 -p 54394 -d postgres -At -v ON_ERROR_STOP=1 -c "SELECT datname FROM pg_database WHERE datname='tinadec_workspace_existing_vector'")
if [[ -z "$existing_database" ]]; then runuser -u postgres -- createdb -h 127.0.0.1 -p 54394 tinadec_workspace_existing_vector; fi
runuser -u postgres -- psql -h 127.0.0.1 -p 54394 -d tinadec_workspace_existing_vector -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA IF NOT EXISTS vector_dependency; CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA vector_dependency;' > "$task_root/evidence/linux-vector-existing-init.log" 2>&1
export TINADEC_TEST_POSTGRES_CONNECTION='Host=127.0.0.1;Port=54394;Username=postgres;Database=tinadec_workspace_existing_vector;Pooling=false'
dotnet test TinadecCore/tests/TinadecCore.Api.Tests/TinadecCore.Api.Tests.csproj --artifacts-path "$task_root/artifacts" --no-build --no-restore --nologo -m:1 --filter 'FullyQualifiedName~PostgreSqlMultiFolderWorkspaceTests' --logger 'trx;LogFileName=linux-workspace-vector-existing.trx' --results-directory "$task_root/evidence" > "$task_root/evidence/linux-workspace-vector-existing.log" 2>&1
printf 'Existing-extension PostgreSQL vector isolation passed\n'
dotnet restore tests/TinadecTools.Tests/TinadecTools.Tests.csproj --artifacts-path "$task_root/artifacts" --nologo > "$task_root/evidence/linux-workspace-tools-restore.log" 2>&1
bash "$evidence/linux-tools-resume.sh" "$task_root"
