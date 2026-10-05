# Api · 可执行宿主：模块架构

模块ID：`CORE-API` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["Api · 可执行宿主"]
    scope["模块整体"]
    f0["Api · 可执行宿主"]
  end
  r0["AspNetCore · 可嵌入 HTTP 层"]
  scope ---|"职责关联，方向待精化"| r0
  subgraph C["已核对的 ProjectReference"]
    cp["Api"]
    c0["AspNetCore"]
    cp -->|"编译引用"| c0
  end
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| Api · 可执行宿主 | 启动可执行 API 宿主，引用 AspNetCore 挂载层。 | [TinadecCore/Api/Program.cs](../../../../../TinadecCore/Api/Program.cs) |

## 已核对的编译引用

工程文件：[TinadecCore/Api/TinadecCore.Api.csproj](../../../../../TinadecCore/Api/TinadecCore.Api.csproj)。

- AspNetCore

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[CORE-API-001](TODO.md#core-api-001)。
