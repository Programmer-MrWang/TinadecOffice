# 文件存储、配置与资源生命周期重构：源码与验收对账

日期：2026-10-09。基线：`f8b233d41601744258773c090cbaa4bd79f30677` + 本次工作树。任务唯一入口：[X-DATA-104](../../docs/development-program/02-modules/cross-cutting/data-security/TODO.md#x-data-104)。产品规范：[§21 存储与配置](../../docs/tinadec-core-product-definition.zh-CN.md)。

本报告记录源码变化和实际证据，不能以编译成功代替操作系统、数据库及真实运行验收。旧路径不导入、不迁移、不删除。

## 源码审计与实施对应

| 原始问题/入口 | 本次实现 | 数据与权限边界 |
| --- | --- | --- |
| Persistence 默认相对 `data`、`data/tinadec.db`，宿主 content root 决定落点 | `StorageHostBootstrap`、`StorageScopePaths` 和不可变 `StorageScopeDescriptor` | 用户 `~/.tinadec`；项目 `.tinadec`；解析路径不创建目录 |
| 单一 Core 组合根和全局工作区资源 | `StorageScopeRegistry` 为每个挂载建立独立 DI 图、DbContext、内容库、工具进程和恢复服务 | header 只接受宿主登记 ID；不接收数据库连接或任意目录；自由会话属于 user |
| 开项目没有统一原子存储初始化 | staging 初始化九类目录、九个 TOML、绑定资源、忽略规则，最后发布 `project.toml` | 幂等不覆盖；冲突/损坏/链接明确失败；不可写使用用户根 projects 外部模式 |
| 设置通过多个数据库写入口管理当前配置 | Tomlyn 文档端口 + projection context decorators | 文件摘要 CAS、原子替换、注释与未改字段保留；历史版本仍是数据库事实，不能删除整库冒充重建投影 |
| 运行读取可变配置，手动修改未统一诊断 | 编译校验、来源摘要、新运行准入复核、配置冻结 | 文件错误阻止依赖它的新运行；已有运行沿冻结版本；后端/根修改需显式重新挂载/重启 |
| `.tinadec` 整体禁止/排除 | 共用 WorkspaceStoragePolicy；默认 code/config/skills；host write ceiling 冻结 | 其他作用域、宿主 security/state 永远不由项目配置授予；第三方 MCP server 进程仍作为可信程序运行 |
| MCP 登记、启动、依赖下载混在一起 | 明确 preview/approved install/uninstall；固定版本、immutable packages、scope cache、receipt | 普通列表/连接不隐式 npx/uvx 下载；外部程序与第三方缓存不清理；复制后不可搬运程序显示 needs_reinstall |
| 项目 Skill 卸载默认走保存分支 | 修正删除分支；live、不可变内容版本和运行副本分开 | 卸载不破坏已冻结引用；SKILL.md 保留原格式 |
| 内容写入取消可能残留 `.tmp` | finally 删除临时文件；读写流租约 | GC 预览和执行时重新核对引用；活跃 stream/run/request 拒绝维护 |
| 永久删除只覆盖 Memory/Lifecycle 部分记录 | Runtime 汇总六个领域模块的 session-owned graph，先写完整恢复 journal 再删除 | 附件/checkpoint/审批/tool/model/组织均参加；共享记忆、全局 grant/规则不误删；内容仅移除引用后另作 GC |
| 后台日志与缓存缺统一生命周期 | 每 scope 200 MiB/10 MiB，logging.toml 可配；缓存手动 preview/apply | 不按天删除会话/运行事实；清缓存、清日志、注销项目、删会话和删项目存储是不同动作 |
| 项目切换后异步请求和浮窗缺稳定归属 | Desktop API/SSE/窗口保存 storage ID，实体键 scope::id；Gateway 只代理 | 迟到响应固定原 scope；相同 project/session UUID 的副本不共用宿主实例 |
| Agent 能从 loopback 绕过文件策略调用数据/审批/项目初始化 API | 受管 Core/Gateway 的全部业务 API 校验宿主私钥；Desktop main 网络层和可信 IPC 签发 | storage ID 只决定归属、不授予权限；普通子进程不继承私钥；公开健康与 HMAC challenge 不暴露私钥 |
| 仅凭健康 JSON 复用本地服务可能向伪造端点泄露宿主私钥 | 先以公开随机 challenge 核对 role/HMAC，再允许向固定受管地址签发 | 错误端点、iframe、未知窗口、导航和重定向拒绝或撤权；默认开发 CDP 端口关闭；可写宿主源码的开发环境不宣称封闭产品安全边界 |
| 关闭时并发 Dispose 提前返回、SQLite 池仍占数据库与 host.lock | Registry 和每个 runtime 共享实际完成任务；停挂载、排空租约、最后关闭宿主图；作用域 SQLite 禁用池 | Windows 实际 FileShare.None 重新打开数据库与 host.lock 验证释放；不靠延时或 GC |
| 用户 PostgreSQL 固定 schema、模型缓存未固定 scope；PG 删除预览只看文件 | 用户根持久独立 UUID，模型缓存从 DbContext options 获取 scope；实际 schema 行内容进入删除摘要 | Linux 并发首次发布稳定；真实 PG 双 schema/十二 context/投影/事务与预览失效验证 |
| 自由会话仅修改 ProjectId | 宿主 durable transfer receipt + admission guard + 双作用域维护租约 | 活跃运行/已受理队列排空后复制完整事实与内容，再删源；失败可按冻结 graph 重试；后续运行采用目标已发布配置 |

代码主要入口：`TinadecCore/Runtime/StorageScopeRegistry.cs`、`StorageScopeInitializer.cs`、`SessionScopeTransferService.cs`、`ProjectSessionLifecycleService.cs`、`ScopeSessionDataGraph.cs`、`StorageMaintenanceService.cs`、`ContentCollectionService.cs`；`TinadecCore/Persistence/Configuration/`；`TinadecTools/Runtime/WorkspaceStoragePolicy.cs`；`apps/desktop/STORAGE.md`。

## 对照与模块文档

五个同类项目均采用本工作区固定提交的源码证据：[Codex / OpenCode / Pi / Gemini CLI / Cherry Studio 对照](../research/2026-10-09-storage-reference-projects.zh-CN.md)。未把另一个产品的约定当作本产品已经实现的行为。

- [配置与转移报告](2026-10-09-configuration-files.zh-CN.md)
- [活动 TOML 原生绑定补正](2026-10-09-native-toml-bindings.zh-CN.md)
- [宿主运行配置来源与嵌入模式](2026-10-09-runtime-configuration-source.zh-CN.md)
- [资源与权限报告](2026-10-09-storage-resources.zh-CN.md)
- [Linux / PostgreSQL 实机报告](2026-10-09-linux-postgresql-validation.zh-CN.md)
- [Persistence 配置文件说明](../../docs/development-program/02-modules/core/Persistence/CONFIGURATION-FILES.md)
- [Desktop](../../apps/desktop/STORAGE.md)、[Gateway](../../TinadecGateway/STORAGE.md)

## 验收证据与边界

定向测试和平台证据统一保存在 [验收账本](../evidence/2026-10-09-storage/VALIDATION.md) 及资源/配置报告的证据目录。Windows 最终作用域/日志/向量15/15、密钥24/24，原生TOML配置差分19/19；Linux配置/迁移/PG22/22、工具沙箱27/27，原生TOML新源码配置/PG差分20/20。增强的同一PG删除预览Fact曾单独1/1。集合及差分不可相加，失败与修复记录均保留。

必须分别区分：Windows 的真实文件/ACL测试、SQLite HTTP测试、配置/迁移/资源测试、Desktop/Gateway测试；Linux/macOS 内核边界和 PostgreSQL 实库单独列结果。没有远程 CI 运行证据不能写“两平台验收完成”。没有真实模型运行不能把两个项目创建会话的测试写成“两项目并发 Agent 运行已验收”。

仍需实机验收的产品场景：真实模型运行中的跨项目 SSE/迟到审批/重启、不可写项目自动外部模式、进程硬退出后的初始化/删除恢复、macOS 内核执行、Linux/macOS/Windows 完整发布包、PostgreSQL 完整业务链及销毁/pg_dump。Linux 内核沙箱和 PG 双 schema 基础契约已有本轮实际证据，不将其写为未运行，也不推断完整平台交付完成。MCP 可执行程序本身和外部模型 harness 的原生工具能力并未因此获得 TinadecTools 文件/Shell 沙箱的保证。
