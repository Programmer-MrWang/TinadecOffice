# Runtime · 唯一组合根：模块架构

模块ID：`CORE-RUNTIME` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

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
