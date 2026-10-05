# Governance · 授权与审批：模块架构

模块ID：`CORE-GOVERNANCE` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["Governance · 授权与审批"]
    scope["模块整体"]
    f0["Governance · 授权与审批"]
  end
  r0["Tools · 工具治理与适配"]
  scope ---|"职责关联，方向待精化"| r0
  r1["Tenancy · 身份与隔离"]
  scope ---|"职责关联，方向待精化"| r1
  r2["AgentGraph · 图与资源"]
  scope ---|"职责关联，方向待精化"| r2
  subgraph C["已核对的 ProjectReference"]
    cp["Governance"]
    c0["Abstractions"]
    cp -->|"编译引用"| c0
    c1["Persistence"]
    cp -->|"编译引用"| c1
  end
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| Governance · 授权与审批 | Core 唯一授权裁决点。权限包络与一次性动作审批分别验证；委托审查受工具、风险与会话授权上限约束。full-access 是用户授权路径。 | [TinadecCore/Governance/GovernanceModuleRegistrar.cs](../../../../../TinadecCore/Governance/GovernanceModuleRegistrar.cs) |

## 已核对的编译引用

工程文件：[TinadecCore/Governance/TinadecCore.Governance.csproj](../../../../../TinadecCore/Governance/TinadecCore.Governance.csproj)。

- Abstractions
- Persistence

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[CORE-GOVERNANCE-001](TODO.md#core-governance-001)。
