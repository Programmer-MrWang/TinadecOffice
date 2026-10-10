# Gateway / 配置、市场、治理与组织代理：模块架构

模块ID：`GW-CONFIG` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["Gateway / 配置、市场、治理与组织代理"]
    scope["模块整体"]
    f0["配置 / 市场 / 模型"]
    f1["治理 / 组织 / 诊断"]
  end
  r0["AgentConfiguration"]
  scope ---|"职责关联，方向待精化"| r0
  r1["Models · 模型与 Harness"]
  scope ---|"职责关联，方向待精化"| r1
  r2["Skills · 市场与集成配置"]
  scope ---|"职责关联，方向待精化"| r2
  r3["Prompts · 提示词组装与版本"]
  scope ---|"职责关联，方向待精化"| r3
  r4["Governance · 授权与审批"]
  scope ---|"职责关联，方向待精化"| r4
  r5["TinaChat · 会话组织通信"]
  scope ---|"职责关联，方向待精化"| r5
  r6["AgentGraph · 图与资源"]
  scope ---|"职责关联，方向待精化"| r6
  r7["Lifecycle · 运行事实与恢复"]
  scope ---|"职责关联，方向待精化"| r7
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| 配置 / 市场 / 模型 | 前端配置与市场路由族，包括harness与model-routes；不存在/api/v1/skills字面路由。发布/安装/模型绑定业务规则由Core完成。 | [TinadecGateway/src/index.ts](../../../../../TinadecGateway/src/index.ts) |
| 治理 / 组织 / 诊断 | 组织与 TinaChat 契约分别有同步生成的接口/路由表；审批、拓扑与调试仍是 Core 权威。 | [TinadecGateway/src/organizationRoutes.ts](../../../../../TinadecGateway/src/organizationRoutes.ts) |

## 2026-10-10 工作区与 AgentPack 错误路径

APP-HOME-107统一持有本次接口回归任务，范围和真实证据见[总报告](../../../../../.tinadec_dev/reports/2026-10-10-interface-regression.zh-CN.md)。以下是本轮已核对的HTTP调用路径，不替代上方模块职责投影。

```mermaid
flowchart LR
  desktop["Desktop 作用域请求"] -->|"HTTP + Storage Id"| routes["Gateway storage/AgentPack routes"]
  routes -->|"固定 scope/宿主 header + If-Match"| core["Core 存储与配置权威"]
  core -->|"JSON/ProblemDetails + 实际 ETag"| projection["raw scope 或公开 mapper"]
  projection -->|"ready/error 行、diagnostics、恢复动作"| desktop
```

- `storageRoutes.ts`保持作用域列表原始代理；`workspace`明确允许null，失败行保留availability/availability_code和具体错误。Gateway不能从坏行推导active生命周期或扩大写权限。
- `projectMapper.ts`投影单行availability与公开恢复信息；已登记但不可读取的工作区保留在列表，lifecycle_status为null。删除/归档的具体规则仍在Core。
- `index.ts`八条AgentPack路由在成功/错误分支前转发Core实际ETag，错误保留规范码及窄diagnostics。HTTP400配置错误不改写成conflict。Gateway不生成安装预览、幂等事实或并发恢复决策。
- 外部OpenAPI、snapshot与Desktop生成schema同步；nullable scope workspace使用`anyOf`，避免旧生成器忽略`$ref + nullable`。

Gateway32定向/101全量通过；上游mock验证的是代理合同。真实Core、当前配置副本、GraphSeed安装与Electron组件结果独立保存在[本轮证据](../../../../../.tinadec_dev/evidence/2026-10-10-interface-regression/)。

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[GW-CONFIG-001](TODO.md#gw-config-001)。
