# Contracts · 对外契约类型：模块架构

模块ID：`CORE-CONTRACTS` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["Contracts · 对外契约类型"]
    scope["模块整体"]
    f0["Contracts · 对外契约类型"]
  end
  r0["Gateway / HTTP、认证与上下文"]
  scope ---|"职责关联，方向待精化"| r0
  r1["共享渲染层 / 路由与 API"]
  scope ---|"职责关联，方向待精化"| r1
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| Contracts · 对外契约类型 | 承载对外契约与类型，不将 MAF 私有类型泄露到持久化或公共 API。网关映射与生成客户端需要同时维护。 | [TinadecCore/Contracts/TinadecCore.Contracts.csproj](../../../../../TinadecCore/Contracts/TinadecCore.Contracts.csproj) |

## 已核对的编译引用

工程文件：[TinadecCore/Contracts/TinadecCore.Contracts.csproj](../../../../../TinadecCore/Contracts/TinadecCore.Contracts.csproj)。

此工程未声明ProjectReference。

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[CORE-CONTRACTS-001](TODO.md#core-contracts-001)。
