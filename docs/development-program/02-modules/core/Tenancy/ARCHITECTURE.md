# Tenancy · 身份与隔离：模块架构

模块ID：`CORE-TENANCY` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["Tenancy · 身份与隔离"]
    scope["模块整体"]
    f0["Tenancy · 身份与隔离"]
  end
  r0["Governance · 授权与审批"]
  scope ---|"职责关联，方向待精化"| r0
  r1["Persistence · 公共存储适配"]
  scope ---|"职责关联，方向待精化"| r1
  subgraph C["已核对的 ProjectReference"]
    cp["Tenancy"]
    c0["Abstractions"]
    cp -->|"编译引用"| c0
    c1["Persistence"]
    cp -->|"编译引用"| c1
  end
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| Tenancy · 身份与隔离 | 统一调用主体、租户和工作区范围，使持久化查询与授权具备可信上下文。 | [TinadecCore/Tenancy/TenancyModuleRegistrar.cs](../../../../../TinadecCore/Tenancy/TenancyModuleRegistrar.cs) |

## 已核对的编译引用

工程文件：[TinadecCore/Tenancy/TinadecCore.Tenancy.csproj](../../../../../TinadecCore/Tenancy/TinadecCore.Tenancy.csproj)。

- Abstractions
- Persistence

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[CORE-TENANCY-001](TODO.md#core-tenancy-001)。
