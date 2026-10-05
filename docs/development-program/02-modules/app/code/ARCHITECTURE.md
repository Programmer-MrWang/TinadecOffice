# Code / 编程工作台：模块架构

模块ID：`APP-CODE` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["Code / 编程工作台"]
    scope["模块整体"]
    f0["Code / 编程工作台"]
  end
  r0["Gateway / 用户工具传输与可选读面"]
  scope ---|"职责关联，方向待精化"| r0
  r1["Desktop / Electron 原生壳"]
  scope ---|"职责关联，方向待精化"| r1
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| Code / 编程工作台 | 文件/Git 读操作调用 Gateway 的 code/tools 面并由 Core 执行；受治理写操作调用 user/tool-actions。用户本地终端经 IPC，智能体终端经 Core。 | [apps/desktop/src/pages/CodePage.vue](../../../../../apps/desktop/src/pages/CodePage.vue) |

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[APP-CODE-001](TODO.md#app-code-001)。
