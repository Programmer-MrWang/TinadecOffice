# Desktop / Electron 原生壳：模块架构

模块ID：`APP-DESKTOP` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["Desktop / Electron 原生壳"]
    scope["模块整体"]
    f0["apps/desktop"]
    f1["Electron main ↔ preload ↔ window.tinadec"]
  end
  r0["共享渲染层 / 路由与 API"]
  scope ---|"职责关联，方向待精化"| r0
  r1["Desktop / 本地服务管理"]
  scope ---|"职责关联，方向待精化"| r1
  r2["Desktop / 偏好与布局持久化"]
  scope ---|"职责关联，方向待精化"| r2
  r3["三平台交付、Manager 与更新"]
  scope ---|"职责关联，方向待精化"| r3
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| apps/desktop | Electron main + preload + Vue renderer。桌面独立窗口和桌宠属于本地交互能力。 | [apps/desktop/package.json](../../../../../apps/desktop/package.json) |
| Electron main ↔ preload ↔ window.tinadec | renderer 通过受控 preload API 使用原生能力。用户打开的本地终端属于桌面功能，与 Core 管理的智能体工具终端是两条路径。 | [apps/desktop/electron/preload.cjs](../../../../../apps/desktop/electron/preload.cjs) |

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[APP-DESKTOP-001](TODO.md#app-desktop-001)。
