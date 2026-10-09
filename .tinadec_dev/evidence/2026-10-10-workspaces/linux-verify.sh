#!/usr/bin/env bash
set -euo pipefail
source_root=/mnt/c/git/agent/TinadecOffice
evidence="$source_root/.tinadec_dev/evidence/2026-10-10-workspaces"
runtime=/var/tmp/tinadec-storage-validation
task_root=$(mktemp -d /var/tmp/tinadec-workspaces-20261010.XXXXXX)
export DOTNET_ROOT="$runtime/sdk"
export PATH="$DOTNET_ROOT:$runtime/bubblewrap/bin:$PATH"
export DOTNET_CLI_HOME="$task_root/dotnet-home"
export NUGET_PACKAGES="$runtime/nuget"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 DOTNET_gcServer=0 MSBUILDDISABLENODEREUSE=1
mkdir -p "$task_root/evidence" "$task_root/pg-socket"
printf '%s\n' "$task_root" > "$evidence/linux-owned-root.txt"
cleanup() {
  if [[ -f "$task_root/postgres/postmaster.pid" ]]; then runuser -u postgres -- pg_ctl -D "$task_root/postgres" -m fast stop || true; fi
  cp -a "$task_root/evidence/." "$evidence/"
}
trap cleanup EXIT
{ date -u; uname -a; dotnet --version; psql --version; bwrap --version; } > "$task_root/evidence/linux-environment.txt"
chmod 755 "$task_root"
install -d -o postgres -g postgres "$task_root/postgres" "$task_root/pg-socket"
runuser -u postgres -- initdb -D "$task_root/postgres" -A trust > "$task_root/evidence/linux-postgres-init.log" 2>&1
runuser -u postgres -- pg_ctl -D "$task_root/postgres" -l "$task_root/postgres/server.log" -o "-h 127.0.0.1 -p 54394 -k $task_root/pg-socket -F" start
runuser -u postgres -- createdb -h 127.0.0.1 -p 54394 tinadec_workspace_validation
export TINADEC_TEST_POSTGRES=1
export TINADEC_TEST_POSTGRES_CONNECTION='Host=127.0.0.1;Port=54394;Username=postgres;Database=tinadec_workspace_validation;Pooling=false'
cd "$source_root"
printf 'Core multi-folder and PostgreSQL tests\n'
dotnet test TinadecCore/tests/TinadecCore.Api.Tests/TinadecCore.Api.Tests.csproj --artifacts-path "$task_root/artifacts" --nologo -m:1 -clp:ErrorsOnly --filter 'FullyQualifiedName~MovingAWorkspaceRetainsRootIdentityAndAllowsSubsequentExplicitEdits|FullyQualifiedName~PostgreSqlMultiFolderWorkspaceTests' --logger 'trx;LogFileName=linux-workspace-core.trx' --results-directory "$task_root/evidence" > "$task_root/evidence/linux-workspace-core.log" 2>&1
printf 'PostgreSQL with an existing vector extension outside public\n'
runuser -u postgres -- createdb -h 127.0.0.1 -p 54394 tinadec_workspace_existing_vector
runuser -u postgres -- psql -h 127.0.0.1 -p 54394 -d tinadec_workspace_existing_vector -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA vector_dependency; CREATE EXTENSION vector WITH SCHEMA vector_dependency;' > "$task_root/evidence/linux-vector-existing-init.log" 2>&1
export TINADEC_TEST_POSTGRES_CONNECTION='Host=127.0.0.1;Port=54394;Username=postgres;Database=tinadec_workspace_existing_vector;Pooling=false'
dotnet test TinadecCore/tests/TinadecCore.Api.Tests/TinadecCore.Api.Tests.csproj --artifacts-path "$task_root/artifacts" --no-build --no-restore --nologo -m:1 --filter 'FullyQualifiedName~PostgreSqlMultiFolderWorkspaceTests' --logger 'trx;LogFileName=linux-workspace-vector-existing.trx' --results-directory "$task_root/evidence" > "$task_root/evidence/linux-workspace-vector-existing.log" 2>&1
printf 'Tools multi-folder and real POSIX kernel tests\n'
dotnet restore tests/TinadecTools.Tests/TinadecTools.Tests.csproj --artifacts-path "$task_root/artifacts" --nologo > "$task_root/evidence/linux-workspace-tools-restore.log" 2>&1
bash "$evidence/linux-tools-resume.sh" "$task_root"
printf 'Linux / PostgreSQL verification passed\n'
