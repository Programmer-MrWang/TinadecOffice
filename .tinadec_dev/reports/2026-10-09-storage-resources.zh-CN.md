# 2026-10-09 存储作用域、资源与沙箱实施

覆盖 Tools 路径分类、Core Skills、托管 MCP 程序及内容临时文件。host registry、目录初始化、转移、purge/GC 和 Desktop 在主报告分别记证据。Windows 本机与 WSL2 Linux 分别提供实际证据；macOS 仅源码和配置构造验证，不宣告 macOS 内核实机验收。

## 路径和生命周期

| 类别 | 作用域路径 | 默认 Agent 权限 | 生命周期 |
| --- | --- | --- | --- |
| 配置源码 | `config` | 可读写 | TOML 权威，DB 投影 |
| Skill 源码 | `skills`；项目 `.tinadec/skills` | 可读写 | 管理操作审阅修订与完整文件集合 |
| 包版本 | `packages/skills`、`packages/project-skills`、`packages/mcp` | 仅准入选中 Skill 包可读 | 不可变；历史保留，目前不自动回收包版本 |
| 运行数据 | `data` | 默认禁止 | 数据库、大内容、会话及运行 |
| 本机状态 | `state` | 默认禁止 | MCP 活跃版本 receipt；用户 host registry 永久保护 |
| 日志、缓存、临时、检出 | `logs/cache/temp/worktrees` | 默认禁止 | 唯一 host 分配 checkout 为源码例外 |
| 用户安全数据 | `~/.tinadec/security` | 永久禁止 | secret 引用、nonce、沙箱凭据 |

`StoragePaths.Root` 仍为 `Data`；资源源目录调用 `IScopeStorageLocations`。源码工作目录和存储根分开，自由工作目录默认 `~/TinadecProjects`。只有 host state 签发并冻结的 `project_storage_write` 可以允许当前作用域内部写入；项目 TOML 和模型参数不能授权。其它作用域、用户 security 与用户 state 保持保护。复制后 frozen storage ID/root 不匹配，prepare/resume/materialize 和用户操作恢复拒绝复用旧授权。

Skills 更新保留版本包，替换真实 live 目录，配置持久失败恢复旧目录。live 源手改同时改变资源条件修订，旧 If-Match 拒绝覆盖；目录预览读 live，运行准入读 retained。项目scope的同一原始源码只枚举为项目资源，复制的受管理共享资源保留原ID，不出现两个ID的同路径条目。卸载删除真实 live 文件；项目更新审阅全部旧资产并删除消失资产，删除后清理空目录。准入仅复制 enabled/selected 包。workspace snapshot 包含 config/skills，排除其它存储分类。当前明确GC针对data/content；不可变包历史全部保留，包版本可达性回收与容量预览作为后续边界。

## MCP 程序与登记

资源登记与程序安装独立。预览仅解析 pinned `npx package@version` / `uvx package==version`，不创建包目录或安装依赖。安装经 `mcp_program_update` 审批，私有 `#managed_mcp_program` 只接受 approved trusted context。npm 固定 registry、禁止 install scripts；uv 固定 PyPI、wheel-only、禁止 Python 下载、copy link mode。包落到 `packages/mcp/<resourceId>/<planHash>`（重新安装用新 generation），receipt 在 `state/mcp-programs/<resourceId>.toml`，manifest 为 `installation.toml`。包内容 hash 准入重验并冻结。

卸载只移除活跃 pointer，保留不可变 program_root 供所有历史 run。损坏包准入拒绝；新预览将显式重装到新 generation，保留旧字节。manifest 的启动路径、参数和 pinned 资源一致性同时校验。初始化复制 npm 包时验证 hash 并重定位 receipt/launcher；UV 环境不可重定位，标 `needs_reinstall`，需要明确安装审批。runner cache/temp 归 scope。Core 管理的 npx/uvx 缺包时直接失败，不执行隐式下载。

**MCP 执行信任边界**：SDK stdio server 程序属于用户登记的可信程序，通过 SDK transport 启动；文件/shell/search 的 OS 沙箱保证不覆盖 server 自身。SDK 子进程使用清洗环境，不继承 `TINADEC_HOST_CONTROL_TOKEN`。

## 平台边界

Windows 按 storage ID 与权限层级分账户，DPAPI 凭据归用户 security；ACL 不再 DenyAll 整个 `.tinadec`。配置/Skills、选中只读包、唯一 checkout 与 scratch 为明确例外。ACL lease 引用计数避免一方释放撤销并发限制；当前用户临时目录真实 ACL 测试证明禁写及最终释放恢复。本轮没有新账户/UAC 安装实测。

Linux 必须 bubblewrap **0.13.0** + Landlock。mount view 隐藏内部目录后绑定窄例外，Landlock继续限制写入。任一机制缺失明确 unavailable，命令不启动，不降级。`scripts/setup-bubblewrap.mjs` 从固定 commit、SHA256 验证源构建到 native/bwrap，或仅校验显式 `TINADEC_TOOLS_BWRAP_PATH`；`stage-runtime.mjs` 校验并复制到 Tools 同目录，缺失/版本错误使 Linux 打包失败。Desktop CI 有构建依赖与明确 setup 步骤，Windows/macOS 不下载。4/4 Node helper 测试验证真实复制字节、错误/缺失拒绝和非Linux跳过。最终追加 WSL2 Linux **6.18.33.2**、x64、self-contained Debug managed Tools + bwrap 0.13.0 实机27/27；不等同于NativeAOT或Linux Desktop安装包验收。

Linux实机首先暴露提前137与`/dev/null`拒绝。bwrap仍保留`--die-with-parent`，启动它的专用后台线程持续等待进程结束，避免短命请求线程退出触发`PR_SET_PDEATHSIG`。精确`/dev/null`改用`--dev-bind`，普通bind的nodev挂载不能打开设备；不新增`/dev`或`/tmp`父目录授权。终止回归修正命名空间`$!`与宿主PID混用，在超时前通过NSpid、父shell唯一脚本及启动时间识别owned宿主子进程；结束后核对身份消失或已退出的zombie状态。

Linux bwrap 动态依赖 `libcap.so.2`（已对实际已构建二进制只读 `readelf` 核查）。`.deb` 明确保留9项既有Electron依赖并增加`libcap2`。`check:deb` 从真实data.tar读取六个运行时可执行文件的64字节ELF/x64头、非空长度及归档执行位，要求bwrap与三个配置资源存在；不能仅凭文件名或已经装有libcap-dev的构建runner判通过。Node专项13/13，含实际小型人工`.deb`归档和损坏bwrap负例，见`.tinadec_dev/tmp/resources-linux-package-tests.log`。**packaging依赖检查已实现，非产品实包验收**。

CI接入代码核查：`posix-core.yml`完整解包含新的原生TOML/作用域与Tools测试，bwrap构建仅Linux；`core-storage-postgres.yml`定向包含十二context独立schema/TOML投影实库测试。`desktop-release.yml`在每个平台打包前增加`ConfigurationDocumentTests|StorageScopeApiTests`与始终上传TRX，tag不再只依赖PR测试接线。三份YAML本地解析通过；本轮没有执行GitHub CI，也未构建或安装完整Linux/macOS产品包。

独立Tools已审批的持久grants属于运行事实，存入当前存储根`state/sandbox-grants.toml`，不读或迁移旧`config/sandbox.json`。原生version/read_paths/write_paths/environment_variables严格校验类型、未知字段、大小、绝对路径与环境名；永久host域、过宽写授权、链接路径拒绝，保存采用同目录临时文件、flush与原子替换。受治理调用始终只用宿主冻结权限，不读、不写、不重置此独立运行历史。Tomlyn2.10.1使用显式source-generated TomlTable typeinfo；47/47 Windows定向及禁用反射后的12/12真实文件回归通过，日志分别为`resources-sandbox-grants-final.log`、`resources-sandbox-grants-no-reflection.log`（均在`.tinadec_dev/tmp`）。未将managed source-generation验证扩大为完整NativeAOT验收。

macOS 使用 Seatbelt/sandbox-exec，按每个保护根排除窄例外；宽 checkout 例外不开放其内部目录。不可用时拒绝执行。本轮没有 macOS 内核实测。POSIX 网络与一般宿主文件读取不提供全面隔离，Tinadec 保护存储有专项读取屏障。

## 验证

Tools 现有定向 65/65；补真实文件与 ACL 后，上下文/POSIX构造/MCP pass-through/存储边界定向 59/59，最终存储边界+POSIX构造 22/22。新增 `ManagedMcpProgramTests` 覆盖纯预览、计划变化拒绝、实际 manifest/pointer、卸载保留、篡改阻断/新目录重装、本地 npm 复制；`ContentTemporaryCleanupTests` 在实际写出内容后模拟失败/取消并检查无临时文件；snapshot 验证 config/skills 恢复与 runtime 保留。

`StorageLifecycleGraphTests` 使用真实11个模块SQLite上下文，验证附件/审批决策/工具执行/模型调用/Agent实例/checkpoint永久删除，共享global CapabilityGrant和另一会话保留；内容GC保护跨会话共享引用和frozen JSON嵌套引用；返回读取stream持有`IContentLeaseRegistry`租约，关闭前GC拒绝。第一次联合46项45通过，唯一导出失败证明Windows目的SQLite连接池占锁，宿主已修复。

资源联合161项157通过，4项修复为Windows路径规范化、导出fixture数据库路径、两条旧MCP自动导入期望（改为无迁移）。最终定向50项49通过，旧4条均通过，MCP/技能/内容/快照/导出/GC通过；唯一新增purge恢复日志用例发现从未创建的运行目录被File.Delete拒绝，宿主修复为只容忍缺失目录后最终1/1通过。项目scope原始技能去重的真实SQLite/目录回归1/1通过，管理内容、稳定资源ID与受治理卸载的完整文件哈希/实际包路径一致，审批前文件仍保留。

日志分别为 `.tinadec_dev/tmp/storage-resources-tests.log`、`storage-resources-final-tests.log`、`storage-purge-recovery-final.log`、`storage-project-skill-final.log`。这是联合加差分复查：已发现失败均有最新通过证据，不能报告为单次全量全绿。真实网络下载安装、Linux NativeAOT/Desktop包和macOS实机作为独立边界。

Linux最终命令/存储专项 **27/27**，0失败、0跳过，10秒：6条真实POSIX命令内核行为、4条实际存储文件行为、17条策略/载荷构造；没有把Windows/macOS早退计作Linux验收。线程退出+/dev/null1.08秒，实际宿主子进程终止8.04秒，允许写、越界写拒绝、环境清洗通过。证据：[日志](linux-storage-validation/dotnet-tools-final-test.log)、[TRX](linux-storage-validation/linux-posix-tools-final.trx)。Windows补构造回归17/17见`.tinadec_dev/tmp/resources-posix-final-tests.log`。原Linux失败日志与误PID观测结果保留，不覆盖为成功。内部存储读取屏障的完整命令矩阵、新Windows账户/UAC及macOS仍未实机验收。
