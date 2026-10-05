# TinadecTools / 网络抓取：模块架构

模块ID：`TOOLS-WEB` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["TinadecTools / 网络抓取"]
    scope["模块整体"]
    f0["Web · 受约束网络抓取"]
  end
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| Web · 受约束网络抓取 | 提供受约束的网页抓取工具。它与浏览器渲染/自动化不是同一个能力。 | [TinadecTools/Tools/Web/WebFetchGuard.cs](../../../../../TinadecTools/Tools/Web/WebFetchGuard.cs) |

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[TOOLS-WEB-001](TODO.md#tools-web-001)。
