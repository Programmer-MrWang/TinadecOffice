# VectorStore · 检索底座：模块架构

模块ID：`CORE-VECTOR` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["VectorStore · 检索底座"]
    scope["模块整体"]
    f0["VectorStore · 检索底座"]
  end
  r0["AgentGraph · 图与资源"]
  scope ---|"职责关联，方向待精化"| r0
  r1["数据、安全与持久化验收"]
  scope ---|"职责关联，方向待精化"| r1
  r2["Models · 模型与 Harness"]
  scope ---|"职责关联，方向待精化"| r2
  subgraph C["已核对的 ProjectReference"]
    cp["VectorStore"]
    c0["Abstractions"]
    cp -->|"编译引用"| c0
    c1["Persistence"]
    cp -->|"编译引用"| c1
  end
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| VectorStore · 检索底座 | 已被AgentGraph证据archive用于向量+关键词混合检索；无embedding可降级关键词。Memory当前仅关键词检索，不能声称长期记忆已接向量。 | [TinadecCore/VectorStore/VectorStoreModuleRegistrar.cs](../../../../../TinadecCore/VectorStore/VectorStoreModuleRegistrar.cs) |

## 已核对的编译引用

工程文件：[TinadecCore/VectorStore/TinadecCore.VectorStore.csproj](../../../../../TinadecCore/VectorStore/TinadecCore.VectorStore.csproj)。

- Abstractions
- Persistence

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[CORE-VECTOR-001](TODO.md#core-vector-001)。
