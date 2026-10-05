# Storage.Migrations.Sqlite：模块架构

模块ID：`CORE-SQLITE` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["Storage.Migrations.Sqlite"]
    scope["模块整体"]
    f0["Storage.Migrations.Sqlite"]
  end
  r0["数据、安全与持久化验收"]
  scope ---|"职责关联，方向待精化"| r0
  subgraph C["已核对的 ProjectReference"]
    cp["Storage.Migrations.Sqlite"]
    c0["Memory"]
    cp -->|"编译引用"| c0
    c1["Lifecycle"]
    cp -->|"编译引用"| c1
    c2["Governance"]
    cp -->|"编译引用"| c2
    c3["Tenancy"]
    cp -->|"编译引用"| c3
    c4["AgentConfiguration"]
    cp -->|"编译引用"| c4
    c5["Models"]
    cp -->|"编译引用"| c5
    c6["Prompts"]
    cp -->|"编译引用"| c6
    c7["DmaEA"]
    cp -->|"编译引用"| c7
    c8["Skills"]
    cp -->|"编译引用"| c8
  end
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| Storage.Migrations.Sqlite | 与 PostgreSQL 迁移工程分开，避免把提供方差异隐藏在领域逻辑中。默认部署使用 SQLite。 | [TinadecCore/Storage.Migrations.Sqlite/TinadecCore.Storage.Migrations.Sqlite.csproj](../../../../../TinadecCore/Storage.Migrations.Sqlite/TinadecCore.Storage.Migrations.Sqlite.csproj) |

## 已核对的编译引用

工程文件：[TinadecCore/Storage.Migrations.Sqlite/TinadecCore.Storage.Migrations.Sqlite.csproj](../../../../../TinadecCore/Storage.Migrations.Sqlite/TinadecCore.Storage.Migrations.Sqlite.csproj)。

- Memory
- Lifecycle
- Governance
- Tenancy
- AgentConfiguration
- Models
- Prompts
- DmaEA
- Skills

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[CORE-SQLITE-001](TODO.md#core-sqlite-001)。
