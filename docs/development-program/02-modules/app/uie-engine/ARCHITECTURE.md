# TinadecUI / UIE Engine：模块架构

模块ID：`APP-UIE-ENGINE` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["TinadecUI / UIE Engine"]
    scope["模块整体"]
    f0["TinadecUI / engine"]
  end
  r0["TinadecUI / UIE Components"]
  scope ---|"职责关联，方向待精化"| r0
  r1["Desktop / 偏好与布局持久化"]
  scope ---|"职责关联，方向待精化"| r1
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| TinadecUI / engine | UIE 是唯一工作台布局系统。engine 不依赖 DOM，处理列/栈/卡片模型、命令总线、布局计算与持久化协议。 | [apps/TinadecUI/src/index.ts:4](../../../../../apps/TinadecUI/src/index.ts#L4) |

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[APP-UIE-ENGINE-001](TODO.md#app-uie-engine-001)。


## 2026-10-06 空间模式数据流

`SpatialPage` 读取既有会话消息、拓扑与活动，投影稳定工作对象 ID；UIE 的 `space` 分支只保存 sessionId、对象几何和视口。Vue Flow 的拖动/尺寸/视口事件通过命令总线提交，`layerStore` 写入 `sessionBySessionId`，沿已有 Electron IPC 保存。画布宿主与预览读取同一对象；预览点击只定位。

来源：[空间首批报告](../../../../../.tinadec_dev/reports/2026-10-06-spatial-mode-first-slice.zh-CN.md)。完整执行能力组合仍由 [APP-RENDERER-104](../shared-renderer/TODO.md#app-renderer-104) 跟踪。

空间几何追加autoHeight/manualPosition，内容测高通过spaceSync更新自动高度与纵向排列，spaceMove记录手动尺寸/位置；旧布局保留坐标，默认400px高度迁为自适应。

## 2026-10-07 目标簇读面

当前SpatialObject分离run/task/instance归属与独立SpatialRelation依赖集合；每run回复独立，未知工具归属保持run级。UIE SpatialSeed提供role/dependencyIds/dependencyUnverified，初次与显式arrangeSpace共享分层安放；compact写入既有空间几何，增量仅安放新ID。详情使用访问后隐藏保留，终端使用原UIE按需右栏宿主并以当前会话run集合过滤，未新增业务store。
