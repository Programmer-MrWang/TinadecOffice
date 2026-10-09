# 2026-10-09 Linux / PostgreSQL 验证记录

结果：**Fedora 44 WSL2 x64、固定 .NET SDK 10.0.300 上，配置/迁移/真实 PostgreSQL 22/22、工具沙箱与存储边界 27/27 定向测试分别通过，均为 0 failed、0 skipped**。前一组包含 16 项配置、5 项会话迁移、1 项真实 PostgreSQL 双 schema 测试；后一组包含 10 个实际 Linux 行为及 17 个构造、序列化和权限测试。随后原生活动 TOML 补正又实际运行 **19 配置 + 1 真实 PG = 20/20、0 skipped、37 秒**，详见 [原生绑定差分](2026-10-09-native-toml-bindings.zh-CN.md)、[最新 TRX](linux-storage-validation/linux-native-configuration-postgresql.trx)、[最新日志](linux-storage-validation/dotnet-native-configuration-postgresql-test.log)；新结果取代旧 22 项中的配置形状边界，没有重复迁移或 Tools 矩阵。bubblewrap 0.13.0 的真实 `--unshare-all` 执行 probe 通过。临时 PostgreSQL 服务在每次退出时正常停止。

证据：[TRX](linux-storage-validation/linux-configuration-transfer-postgresql.trx)、[完整构建/测试日志](linux-storage-validation/dotnet-test.log)、[SDK 来源](linux-storage-validation/sdk-source.json)、[SDK 信息](linux-storage-validation/dotnet-info.txt)、[PostgreSQL 版本](linux-storage-validation/postgres-version.txt)、[bubblewrap probe](linux-storage-validation/bubblewrap-probe.txt)、[固定 commit](linux-storage-validation/bubblewrap-commit.txt)、[archive hash](linux-storage-validation/bubblewrap-source-sha256.txt)、[工具包版本](linux-storage-validation/tool-packages.txt)。

本报告限配置、迁移、十二 DbContext 数据库契约及下列定向工具沙箱矩阵；不将它们折算为完整 Linux NativeAOT/桌面打包、HTTP/Desktop、macOS 或全部产品功能验收。工具子进程使用 Debug managed self-contained 发布，实际执行内核沙箱。

## 实际隔离方式

源码使用挂载路径 `/mnt/c/git/agent/TinadecOffice`，SDK、NuGet、artifacts、PostgreSQL cluster 均位于独立 Linux 临时工作区。入口保持 `/tmp/tinadec-storage-validation`；由于 WSL VM 重启会清空 `/tmp`，它链接到 WSL 的 `/var/tmp/tinadec-storage-validation` 保留证据和依赖。没有复用 Windows obj，未启用 PostgreSQL 系统服务，也没有使用用户数据库。

临时 PostgreSQL 18.6 绑定 `127.0.0.1:54393` 与私有 socket，独立数据库 `tinadec_storage_validation`；测试在其中创建两个随机 schema，finally 删除这两个 schema。脚本退出的 trap 停止服务，并将证据复制到本报告目录。为减少网络重复下载，只读复制 Windows 已缓存的 68 个公共 NuGet 包到 Linux 私有 cache，实际 restore、编译、运行均在 Linux 执行。

脚本：`.tinadec_dev/tmp/linux-storage-prepare.sh`、`linux-storage-run.sh`。主要运行命令：

```bash
TINADEC_TEST_POSTGRES=1 dotnet test .tinadec_dev/tmp/config-file-tests/ConfigFile.Tests.csproj \
  --artifacts-path /tmp/tinadec-storage-validation/artifacts \
  --logger 'trx;LogFileName=linux-configuration-transfer-postgresql.trx' \
  --results-directory /tmp/tinadec-storage-validation/evidence
```

## 平台中发现与修复的真实问题

第一次实际 PG 测试失败：`ScopeModelCacheKeyFactory` 在模型创建期间调用 `context.Database.ProviderName/GetDbConnection`，触发模型递归。修复从 `IDbContextOptions` 的关系型 extension 读取 provider、连接摘要和 history schema，不进入正在创建的模型。最终 PG 测试通过。

Linux 用户存储身份并发测试发现 `File.Move(overwrite:false)` 不能单独保证多个初始调用只选一个 UUID；Windows 原验证曾通过。修复以 `state/.storage-identity.lock` 的 OS 独占句柄保护首次发布，完整临时文件 flush 后再发布。最终 Linux 的 12 个并发初始化调用得到同一身份，同根重启稳定，新根不同；已建立的身份丢失或非法拒绝重新生成。

项目缺失文件测试确认：存在已完成 `project.toml` 时，即使复制项目没有 State 标记且当前 SQL 投影为空，缺少配置文件仍拒绝补默认。运行时、存储和日志引导也不能重写已建立但被删除的文件。

较早准备阶段曾有 WSL `CreateVm/0x800705b4` 超时和 `/tmp` 内容丢失；当时主机可用内存约 263660 KB / 16 GB。未执行全局 WSL shutdown 或 Windows 重启。等待其他构建释放资源并保留临时工作区后完成实际验收。这些失败没有算作通过。

## 必要环境改动与固定来源

WSL DNF 安装构建/测试工具及依赖：gcc、make、meson、ninja-build、git、postgresql-server、postgresql，随后安装 libcap-devel 2.78（连带 libcap 更新）。首批交易显示 87 个新包和 13 个依赖更新。`util-linux-user` 虽曾在请求列表中，最终 rpm 查询显示未独立安装；现有 `runuser` 可用且已真实用于启动/停止测试 PostgreSQL。准确版本以工具包证据为准。

SDK 官方 metadata：`https://builds.dotnet.microsoft.com/dotnet/release-metadata/10.0/releases.json`。

SDK 下载：`https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.300/dotnet-sdk-10.0.300-linux-x64.tar.gz`。

SDK SHA512：`a0c404c1a2f85d70e32392ce297eb388c0310c519521b538a031a895469444c67f347d4f9ca1f8441f525967a89c9b75e2cd1676da486f95118cf4025c38d904`，下载后核对一致才解压。

bubblewrap v0.13.0 固定 commit：`719a4fd474d44b26906bcf2b1b0fb6eddd8d56d0`。

官方 archive：`https://codeload.github.com/containers/bubblewrap/tar.gz/719a4fd474d44b26906bcf2b1b0fb6eddd8d56d0`。

archive SHA256：`e55bdb06f051664ecd3297d449a8b679b7cd1c73adb292b73a81d9b03c5fc462`，构建前核对一致。Meson 禁用 man/tests/SELinux 可选依赖，安装于隔离工作区；未替换发行版系统 bwrap。

## PostgreSQL 显式验收契约

`TinadecCore/tests/TinadecCore.Api.Tests/PostgreSqlScopeValidationTests.cs` 要求 `TINADEC_TEST_POSTGRES=1` 与 `TINADEC_TEST_POSTGRES_CONNECTION`。未启用时 Fact 明确 skip；启用却没有连接或服务时失败。真实测试验证十二 DbContext 全部模型表存在、两个 schema 内相同 session/config ID 独立、TOML 投影只改本 scope、事务 rollback，以及 schema 清理。

最终补充审查发现，项目删除预览不能只摘要本地文件，否则 PostgreSQL 内新增或更新事实不会使旧预览失效。修复从实际 scope options 读取 owned schema，在 RepeatableRead 事务中按表和规范化 JSON 行排序计算摘要，统计、cache、日志变化不作为数据库事实。增强的同一 PG Fact 又在真实服务上 **1/1 通过、0 skipped、20 秒**：[专项 TRX](linux-storage-validation/linux-postgresql-delete-preview.trx)、[专项构建/测试日志](linux-storage-validation/dotnet-postgresql-delete-preview-test.log)。两次未变预览均通过事实摘要门禁并到达 stub Registry 的安全拒绝；预览后插入、修改 session 分别拒绝 `changed after the preview`，事实完整保留，另一 schema 不受影响。stub 所有销毁接口均拒绝，未实际执行项目删除；临时服务在退出时 fast stop 完成。脚本 `.tinadec_dev/tmp/linux-postgresql-delete-preview-run.sh` 只重跑此 Fact，保留先前全 22 项证据。

Windows 早先没有服务环境时准确显示 `19 passed, 1 skipped`，见 [TRX](configuration-and-transfer-tests/configuration-and-transfer-final.trx)；这不是 PG 验收结果。当前 Linux 最终 22 项均实际执行。

模块任务入口：[CORE-AGENT-CONFIG-003](../../docs/development-program/02-modules/core/AgentConfiguration/TODO.md#core-agent-config-003)。该任务保留 macOS 实际运行结果的待验收项，避免以 Linux 结果代表另一平台。

## Linux Tool 沙箱矩阵（独立于上述 22 项）

在同一 Fedora / bwrap 0.13.0 环境补跑 `PosixSandboxIntegrationTests` 与 `StorageBoundaryTests`。首次 framework-dependent launcher 在沙箱清理环境后找不到隔离 SDK；因此显式发布 Debug managed self-contained TinadecTools，使用 app-local runtime 重跑，不改全局 SDK 搜索位置。这个发布不代表 NativeAOT 或完整桌面发布产物验收。

早期 TRX 共 12 项，10 passed / 2 failed；其中 2 项仅 Windows、1 项仅 macOS，在 Linux 提前返回，所以当时真正 Linux 行为是 **7 passed / 2 failed（9 项）**。失败保留在 [早期实机日志](linux-storage-validation/dotnet-tools-self-contained-test.log) 和 [早期 TRX](linux-storage-validation/linux-posix-tools-self-contained.trx)：目录内写入发生 exit 137（stdout 已出现 started，204 ms）；进程组终止测试报告 `/dev/null` Permission denied 后退出 137。

资源模块据真实证据做最小修复：精确 `/dev/null` 挂载改为 `--dev-bind`，普通 bind 会令设备节点 nodev；不开放其父目录 `/dev`。Linux 用独立生存线程启动 bwrap，并在该线程持续等待退出，保留 `--die-with-parent`，防止请求线程结束触发提前 SIGKILL。新增实机测试主动结束请求 Thread，再确认延迟命令继续执行、`/dev/null` 读写正常、宿主授权文件真实存在。

修复后的第一次重跑 **26 passed / 1 failed** 另存 [阶段日志](linux-storage-validation/dotnet-tools-before-pid-observation-fix.log)、[阶段 TRX](linux-storage-validation/linux-posix-tools-before-pid-observation-fix.trx)。剩余终止测试原先在父侧以 `kill(pid, 0)` 检查沙箱 `$!`，但是 bwrap `--unshare-all` 开启 PID namespace，该数字不是宿主 PID。最终测试在命令仍运行时通过 `/proc` 的 NSpid、父 shell 的唯一脚本标记解析准确 host PID，并冻结其 starttime；超时后验证同一进程身份已经消失或进入 Z（已终止待回收）状态，避免 PID 重用误判。

**最终 27/27、0 failed、0 skipped，10 秒**：[最终日志](linux-storage-validation/dotnet-tools-final-test.log)、[最终 TRX](linux-storage-validation/linux-posix-tools-final.trx)、[构建日志](linux-storage-validation/tools-final-build.log)、[self-contained 发布日志](linux-storage-validation/tools-final-publish.log)。其中 6 个 POSIX 实机行为、4 个 scope 文件/环境边界行为和 17 个构造/序列化/权限检查。新增线程生存与设备测试耗时 1.08 秒，进程组终止测试耗时 8.04 秒；三个非 Linux 提前返回用例明确从 filter 排除，没有计作通过。

复跑脚本 `.tinadec_dev/tmp/linux-tools-rerun.sh` 使用独立 `/var/tmp/tinadec-storage-validation/tools-artifacts`，先 build tests，发布 `TinadecTools -c Debug -r linux-x64 --self-contained true -p:PublishAot=false`，复制 app-local runtime 到测试目录，再运行：

```bash
dotnet vstest /var/tmp/tinadec-storage-validation/tools-artifacts/bin/TinadecTools.Tests/debug/TinadecTools.Tests.dll \
  --TestCaseFilter:'(FullyQualifiedName~PosixSandboxIntegrationTests|FullyQualifiedName~StorageBoundaryTests|FullyQualifiedName~PosixSandboxTests)&FullyQualifiedName!~Windows&FullyQualifiedName!~SeatbeltProfile_CarriesTheCanonicalFormOfEveryGrant' \
  --logger:'trx;LogFileName=linux-posix-tools-final.trx' \
  --ResultsDirectory:/var/tmp/tinadec-storage-validation/evidence
```

`TINADEC_TOOLS_BWRAP_PATH` 未显式设置；宿主 PATH 指向固定临时安装的 `bubblewrap/bin`。SDK、publish、test artifacts、包缓存均保持临时隔离；没有覆盖系统 SDK 或系统 bwrap，没有使用产品账号数据。
