# 多文件夹工作区验证证据

基线 main d5e6c8d838f93f6bc26d4b7b77ecb0d9bdb9c2f3 + 工作树，2026-10-10。正式任务 APP-HOME-107；报告 [sidebar-workspaces](../../reports/2026-10-10-sidebar-workspaces.zh-CN.md)。所有夹具使用随机临时用户根，不复制真实配置或凭据；历史失败保留，不与最终结果混称。

| 层级 | 入口/结果 | 范围 |
| --- | --- | --- |
| Desktop Vue | `npx vitest run src/controllers/HomeController.test.ts src/components/AppSidebar.test.ts src/components/WorkspaceEditorDialog.test.ts src/composables/useWorkspaceList.test.ts`；desktop-tests-final.json | 62/62 |
| Desktop 类型 | `npm run typecheck` | vue-tsc 无错误 |
| Native IPC | `node --test electron/workspaceFolders.test.cjs` | 1/1，可信 sender、多选数组、取消 |
| Gateway | `bun test src/storageProxy.test.ts src/openapi.snapshot.test.ts` | 6/6，scope/CAS/ETag/错误/快照 |
| Windows Core | workspace-core*.trx、storage-baseline.trx、workspace-move-final.trx、workspace-persistence-final.trx | 去重 62 通过、1 PG 明确 skip、0 失败；最后配置/删除专项 21/21 已去重 |
| 资源引用 | workspace-resource-claims.trx | 主/附加根同名路径不混淆、读取前缀及共享技能 |
| Windows Tools | workspace-tools*.trx、tool-process.json | 根集合、读写/搜索/越界/保护目录、真实普通用户 cwd/Git；低权限 Shell 另列 |
| Windows 原生 UI | desktop-native.json、desktop-native-http.json、workspace-*.png | 真实目录多选，实际组件/生产 preload，真实 Core/Gateway；会话行是 UI 夹具 |
| 主题视觉夹具 | ui-renderer.mjs、ui-electron.cjs、ui-server.mjs、visual-*.png | 生产 useTheme/材质，隔离服务与组件；stub picker 不取代原生证据 |
| Linux/PG | linux-verify.sh、linux-environment.txt、linux-workspace-*.trx/log、linux-result.json | Fedora44/WSL2；Core去重28/28、Tools28/28；PostgreSQL18.6/pgvector空库和已有扩展两环境、真实Bubblewrap/Landlock |
| 去重账本 | `node .tinadec_dev/evidence/2026-10-10-workspaces/validation-summary.mjs` | 各平台各用例取最近结果，不把重复回归相加 |

Windows Core/Tools 使用 `dotnet test <工程> --artifacts-path .tinadec_dev/tmp/<独立输出> -m:1 --filter '<专项用例>' --logger 'trx;LogFileName=<结果>' --results-directory .tinadec_dev/evidence/2026-10-10-workspaces`。不构建到正在运行的用户服务输出目录。

Linux 脚本通过 `wsl -d FedoraLinux-44 --exec bash /mnt/c/git/agent/TinadecOffice/.tinadec_dev/evidence/2026-10-10-workspaces/linux-verify.sh` 启动，仅关闭自己创建的临时集群；SDK/包缓存取已安装测试 runtime，不影响用户数据库。修复后增量运行通过 `linux-resume.sh <已校验的本轮临时根>`，复用已停机的自有数据库和 artifacts。PG 在空库与已有非公共 namespace 的扩展库分别运行同一验收，不把重复测试累计。缺 pgvector、移动 open、向量类型/参数及时间精度失败记录分别保留。测试中的 PG 连接是本机独立 trust 集群，不含用户连接或密钥。

`linux-tools-resume.sh` 为 framework-dependent 测试 apphost 临时注册既有 runtime，结束后还原 `/etc/dotnet/install_location_x64`，不把 DOTNET_ROOT 传入受限命令。两源目录都放在程序目录及隐式 temp 授权之外；初次运行时缺运行时注册及夹具落在 apphost 只读目录的失败分别保留 initial/second TRX。最终实际子进程结果通过；环境登记与自有集群均已检查清理。

Windows 低权限 Shell 系统授权没有自动接受，tool-process-failure.json 记录超时；普通用户 runner/Git 不替代该验收。macOS 与发布安装器未执行。本轮无发布、推送、外部通信或真实用户数据重置。
