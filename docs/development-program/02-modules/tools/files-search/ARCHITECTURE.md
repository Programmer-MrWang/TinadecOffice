# TinadecTools / 文件与搜索：模块架构

模块ID：`TOOLS-FILES` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["TinadecTools / 文件与搜索"]
    scope["模块整体"]
    f0["FileRW / Search · 文件与搜索"]
  end
  r0["AgentGraph · 图与资源"]
  scope ---|"职责关联，方向待精化"| r0
  r1["三平台交付、Manager 与更新"]
  scope ---|"职责关联，方向待精化"| r1
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| FileRW / Search · 文件与搜索 | 统一工作区路径解析与允许根，读写与搜索面分明；文件写还受审批与确认字段约束。 | [TinadecTools/Tools/FileRW/FileSystemTools.cs](../../../../../TinadecTools/Tools/FileRW/FileSystemTools.cs) |

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[TOOLS-FILES-001](TODO.md#tools-files-001)。
