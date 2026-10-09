# Runtime · 唯一组合根：模块架构

模块ID：`CORE-RUNTIME` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

2026-10-09 存储运行图（当前源码）。`StorageScopeRegistry.MountAsync` 在每个服务图中重新注册模块与 HTTP 端口，数据库连接、单例、后台 worker 和工具进程不跟随 UI 的当前项目改变。

```mermaid
flowchart TD
  open["用户打开项目 / 宿主登记"] --> init["原子初始化 staging → project.toml"]
  open --> registry["StorageScopeRegistry / projects.toml"]
  request["HTTP / SSE + host key + storage ID"] --> auth["可信宿主认证 / HMAC服务身份"]
  auth --> registry
  registry --> user["user 独立服务图"]
  registry --> project["project 独立服务图"]
  project --> config["TOML 校验 / 摘要 / 文件投影"]
  project --> database["独立 SQLite 或 PostgreSQL schema"]
  project --> resources["内容库 / 工具进程 / 后台恢复"]
  project --> logs["scope logs / cache / temp"]
  transfer["SessionScopeTransferService"] -->|"双维护租约，先复制后删源"| user
  transfer --> project
  purge["session-owned graph + durable purge journal"] --> database
  gc["预览 + 引用与stream/run租约复核"] --> resources
```

项目文件只提供内容和配置，`allow_storage_write` 的可信上限属于用户根 state 登记与宿主 IPC；`HostProtectedRoots` 在新运行准入冻结其他作用域及安全库路径。完整模型运行和各平台内核证据另见 [X-DATA-104](../../cross-cutting/data-security/TODO.md#x-data-104)。

`StorageScopeShutdownHostedService` 在主图 worker 前登记，停止顺序使它最后等待所有子图关闭；Registry 和 runtime 的并发 AsyncDispose/Stop 等待同一实际完成任务。关闭先阻止新挂载/维护/租约，现有 SSE、运行和内容流完成后才释放数据库及 `host.lock`。Windows以实际独占重新打开证明句柄释放。项目销毁预览包含SQLite一致备份或PostgreSQL owned schema 的RepeatableRead行摘要，执行前再次核对，不能只凭目录统计删除新事实。

```mermaid
flowchart LR
  subgraph S["Runtime · 唯一组合根"]
    scope["模块整体"]
    f0["Runtime · 唯一组合根"]
  end
  r0["Governance · 授权与审批"]
  scope ---|"职责关联，方向待精化"| r0
  r1["AgentConfiguration"]
  scope ---|"职责关联，方向待精化"| r1
  r2["TinaChat · 会话组织通信"]
  scope ---|"职责关联，方向待精化"| r2
  r3["AgentGraph · 图与资源"]
  scope ---|"职责关联，方向待精化"| r3
  subgraph C["已核对的 ProjectReference"]
    cp["Runtime"]
    c0["Abstractions"]
    cp -->|"编译引用"| c0
    c1["Contracts"]
    cp -->|"编译引用"| c1
    c2["Persistence"]
    cp -->|"编译引用"| c2
    c3["VectorStore"]
    cp -->|"编译引用"| c3
    c4["Tenancy"]
    cp -->|"编译引用"| c4
    c5["AgentConfiguration"]
    cp -->|"编译引用"| c5
    c6["DmaEA"]
    cp -->|"编译引用"| c6
    c7["Models"]
    cp -->|"编译引用"| c7
    c8["Context"]
    cp -->|"编译引用"| c8
    c9["Prompts"]
    cp -->|"编译引用"| c9
    c10["Memory"]
    cp -->|"编译引用"| c10
    c11["Skills"]
    cp -->|"编译引用"| c11
    c12["LoopGuard"]
    cp -->|"编译引用"| c12
    c13["Lifecycle"]
    cp -->|"编译引用"| c13
    c14["Governance"]
    cp -->|"编译引用"| c14
    c15["Tools"]
    cp -->|"编译引用"| c15
    c16["TinaChat"]
    cp -->|"编译引用"| c16
    c17["AgentGraph"]
    cp -->|"编译引用"| c17
    c18["Storage.Migrations.Sqlite"]
    cp -->|"编译引用"| c18
    c19["Storage.Migrations.PostgreSql"]
    cp -->|"编译引用"| c19
  end
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| Runtime · 唯一组合根 | 负责全模块装配和跨模块适配：身份边界、正式模式、模型策略、用户工具动作、恢复、就绪探针。可选择性装配模块。 | [TinadecCore/Runtime/TinadecCoreServiceCollectionExtensions.cs:32](../../../../../TinadecCore/Runtime/TinadecCoreServiceCollectionExtensions.cs#L32) |

## 已核对的编译引用

工程文件：[TinadecCore/Runtime/TinadecCore.Runtime.csproj](../../../../../TinadecCore/Runtime/TinadecCore.Runtime.csproj)。

- Abstractions
- Contracts
- Persistence
- VectorStore
- Tenancy
- AgentConfiguration
- DmaEA
- Models
- Context
- Prompts
- Memory
- Skills
- LoopGuard
- Lifecycle
- Governance
- Tools
- TinaChat
- AgentGraph
- Storage.Migrations.Sqlite
- Storage.Migrations.PostgreSql

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[CORE-RUNTIME-001](TODO.md#core-runtime-001)。
