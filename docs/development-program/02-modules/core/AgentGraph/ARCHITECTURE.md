# AgentGraph · 图与资源：模块架构

模块ID：`CORE-AGENT-GRAPH` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["AgentGraph · 图与资源"]
    scope["模块整体"]
    f0["AgentGraph · 图与资源"]
  end
  r0["Tools · 工具治理与适配"]
  scope ---|"职责关联，方向待精化"| r0
  r1["TinaChat · 会话组织通信"]
  scope ---|"职责关联，方向待精化"| r1
  r2["VectorStore · 检索底座"]
  scope ---|"职责关联，方向待精化"| r2
  subgraph C["已核对的 ProjectReference"]
    cp["AgentGraph"]
    c0["Abstractions"]
    cp -->|"编译引用"| c0
    c1["Persistence"]
    cp -->|"编译引用"| c1
  end
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| AgentGraph · 图与资源 | 管理图协作资源、写范围冲突、环境登记与执行目标解析、审批规则及证据检索。登记能力不等同于完整远程资源隔离。 | [TinadecCore/AgentGraph/AgentGraphModuleRegistrar.cs](../../../../../TinadecCore/AgentGraph/AgentGraphModuleRegistrar.cs) |

## 已核对的编译引用

工程文件：[TinadecCore/AgentGraph/TinadecCore.AgentGraph.csproj](../../../../../TinadecCore/AgentGraph/TinadecCore.AgentGraph.csproj)。

- Abstractions
- Persistence

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[CORE-AGENT-GRAPH-001](TODO.md#core-agent-graph-001)。
