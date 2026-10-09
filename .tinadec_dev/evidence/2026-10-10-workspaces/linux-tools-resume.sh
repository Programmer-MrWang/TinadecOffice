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
# Framework-dependent test launchers lose DOTNET_ROOT under the production
# environment policy. Register only the owned test runtime, then restore the host.
registration=/etc/dotnet/install_location_x64
registered=false
created_directory=false
cleanup() {
  if $registered && [[ -f "$registration" && "$(cat "$registration")" == "$runtime/sdk" ]]; then rm -- "$registration"; fi
  if $created_directory; then rmdir /etc/dotnet 2>/dev/null || true; fi
  cp -a "$task_root/evidence/." "$evidence/"
}
trap cleanup EXIT
if [[ ! -d /etc/dotnet ]]; then mkdir /etc/dotnet; created_directory=true; fi
if [[ ! -e "$registration" ]]; then
  (set -o noclobber; printf '%s\n' "$runtime/sdk" > "$registration")
  registered=true
fi
printf 'launcher_runtime_registration=%s\nlauncher_registered_location=%s\n' "$registration" "$(cat "$registration")" > "$task_root/evidence/linux-tool-runtime.log"
cd "$source_root"
dotnet test tests/TinadecTools.Tests/TinadecTools.Tests.csproj --artifacts-path "$task_root/artifacts" --no-restore --nologo -m:1 -clp:ErrorsOnly --filter 'FullyQualifiedName~MultiFolderToolTests|FullyQualifiedName~PosixSandboxTests|FullyQualifiedName~PosixSandboxIntegrationTests' --logger 'trx;LogFileName=linux-workspace-tools.trx' --results-directory "$task_root/evidence" > "$task_root/evidence/linux-workspace-tools.log" 2>&1
printf '{"accepted":true,"postgresql":"isolated real cluster; fresh and existing extension namespaces","platform":"Linux WSL2","owned_root":"%s","sandbox":"Bubblewrap 0.13.0 plus Landlock; temporary test runtime registration restored"}\n' "$task_root" > "$task_root/evidence/linux-result.json"
