---
name: WS-9 lane 模块化：引擎 lane 编排 partial 拆文件 + Orchestration 模型归位
overview: 把 FullDuplexRunEngine.cs（4878 行）里 675 处 lane 纠缠按 DmaEA 项目内部组织调整拆分：引擎改 partial，lane 编排成员原样搬入 DmaEA/FullDuplexRunEngine.Lanes.cs；lane 模型类型与协议常量归位 DmaEA/Orchestration/。零接口、零行为变更、零契约改动，仅文件级组织 + 常量可读性提升，随后全量回归对账并提交。
todos:
  - id: ws9-partial-split
    content: 用 [subagent:code-explorer] 产出成员边界与依赖清单，引擎 partial 化并把 lane 编排搬入 FullDuplexRunEngine.Lanes.cs（分块编译）
    status: completed
  - id: ws9-orchestration-module
    content: lane 模型/协议迁入 Orchestration/，新增 LaneStatus 常量化并替换字面量、补齐引用 using
    status: completed
    dependencies:
      - ws9-partial-split
  - id: ws9-contract-tests
    content: 新增 LaneWait JSON 往返与 LaneStatus 值钉住测试、Orchestration 命名空间架构边界断言
    status: completed
    dependencies:
      - ws9-orchestration-module
  - id: ws9-docs
    content: 更新产品定义 §6.4.1 与 AGENTS.md（模块边界 + lane 与包零绑定/当前不可达的事实澄清）
    status: completed
    dependencies:
      - ws9-orchestration-module
  - id: ws9-regression-commit
    content: 全量回归对账（含契约三件套零漂移）并提交 WS-9
    status: completed
    dependencies:
      - ws9-contract-tests
      - ws9-docs
---

## 产品概述
WS-9 的实质是 `TinadecCore.DmaEA` 项目内部的文件组织调整（非跨模块解耦）：把 `FullDuplexRunEngine.cs`（4878 行）中约 1900 行 lane 编排代码，通过 partial class 拆到独立文件，使引擎主文件降到约 3000 行、lane 逻辑集中落位。

## 事实前提（本轮三轮澄清的结论，须写入文档避免后续再次误解）
- **lane 与智能体包零耦合**：GraphSeedPack 的 manifest.json 与 index.ts 中 lane 命中数均为 0，退役的 office 包同样为 0；不存在"从包里拆出来"这件事。
- **lane 的真实归属**：DmaEA 内部的 run 级多泳道并行编排机制（每 lane 独立规划器、任务子图、gate review、等待汇聚、升级人工），开关在 TOML 运行时基线 `[orchestration] lanes_enabled`（出厂 false）。
- **lane 当前不可达**：Phase 2 起每个模式都冻结 Graph 段，`RunFreezeGate` 在 admission 就拒 `lanes_enabled=true`（`graph_tier_lanes_unsupported`），测试注释原文为 "the lane machinery is unreachable, not silently degraded"。
- **但契约面仍在每天使用**：`lane_key` DTO 字段（OpenAPI required）、三张表 LaneKey 列、审批 lane 匹配规则、replay/orchestration 的 lanes 投影、前端按 lane 分组渲染 —— 因此只做组织调整，不删除、不改契约。

## 核心功能
1. **引擎 partial 拆分**：`FullDuplexRunEngine` 改为 partial，lane 编排成员（开启协议与指令链、lane 规划、lane 监督与 gate review、等待汇聚、lane 状态机）原样搬入 `DmaEA/FullDuplexRunEngine.Lanes.cs`；零接口、零调用改动、零行为变更。
2. **lane 模型落位**：`DurableLane`/`LaneWait`/`LaneWaitJsonConverter`/`CriterionVerdict` 与协议常量迁入 `DmaEA/Orchestration/`；新增 `LaneStatus` 常量类（值不变）替换散落的 lane 状态字面量。
3. **契约保护与验证**：LaneWait JSON 持久化往返测试、LaneStatus 值钉住测试、架构断言（防 lane 模型反向依赖引擎/MAF）、契约三件套零漂移核验、抽取前后全量回归对账。
4. **文档记录**：产品定义 §6.4.1 补记模块边界与冻结期拒 lane 的事实；`AGENTS.md` 记录本轮与事实澄清。

## 视觉与交互效果
无 UI 变更（不改前端、不改 DTO、不改事件名）。

## 范围边界（用户已确认）
- 不含：spec 原方案的"独立类 LaneCoordinator + 窄接口"（接口成本会吃掉收益，已放弃）。
- 不含：`ValidateAndMaterializeGraph`/`MergeReplannedGraph`（任务图通用逻辑，留引擎）。
- 允许：零行为变更的可读性提升（lane 状态字面量提取为常量类，值不变）。

## 技术栈
沿用仓库既有技术栈，不引入新依赖：.NET 10 / C# `partial class` / xUnit / NetArchTest（Architecture 测试）/ dotnet build 分批编译验证。

## 实现方案

### 一、文件布局（目标态）
```
TinadecCore/
├── DmaEA/
│   ├── FullDuplexRunEngine.cs                     # [MODIFY] 改 partial；移除 lane 成员；保留分流与交织路径
│   ├── FullDuplexRunEngine.Lanes.cs               # [NEW] lane 编排（partial 部分，同一类同一命名空间 TinadecCore.DmaEA）
│   └── Orchestration/
│       ├── OrchestrationDirectiveValidator.cs     # [不动]
│       ├── LaneModel.cs                           # [NEW] DurableLane / LaneWait / LaneWaitJsonConverter / CriterionVerdict
│       └── LaneProtocol.cs                        # [NEW] LaneOpenProtocol / LaneOpenMarker / LaneStatus
├── tests/
│   ├── TinadecCore.AgentFramework.Tests/
│   │   ├── DmaeaLaneModelTests.cs                 # [MODIFY] 类型迁移后补 using（测试引用的引擎 static 成员不变）
│   │   └── LaneModelContractTests.cs              # [NEW] LaneWait JSON 往返 + LaneStatus 值钉住
│   └── TinadecCore.Architecture.Tests/
│       └── GraphOrchestrationArchitectureTests.cs # [MODIFY] 加 Orchestration 命名空间边界断言
├── docs/tinadec-core-product-definition.zh-CN.md  # [MODIFY] §6.4.1 补记
AGENTS.md                                          # [MODIFY] 本轮记录 + 事实澄清
```
按编译错误驱动补齐 using 的其它文件（`RunReplayService.cs`、`DmaeaEndpoints.cs` 等若引用迁移类型）：编译期安全，无行为影响。

### 二、搬迁清单（精确到成员，分批搬运、每批编译）
**搬入 `FullDuplexRunEngine.Lanes.cs`**（partial，同命名空间与可见性不变）：
- ① 开启协议与指令链：`LaneOpenProtocol` / `LaneOpenMarker`、`ExtractLaneOpenLine` / `TryReadLaneKey`、`FinalizeInteractionTextAsync`、`ApplyPendingOrchestrationDirectivesAsync`、`ConsumeOrchestrationDirectiveAsync`、`DrainRunDirectivesAsync`
- ② lane 规划：`EnsureLanePlannerAsync`、`PlanLaneTasksAsync`、`ReadLaneTasks`、`ReadLaneWaits`、`PlannerInstructions`
- ③ 监督与 gate：`SuperviseLaneAsync`、`RunGateReviewAsync`、`BuildGatePrompt`、`ParseGateDecision`（+ `GateDecision`/`GateDecisionBody`）、`RejectStaleGateAsync`、`MapCriterionVerdicts`
- ④ 等待汇聚（纯静态）：`UnmetLaneWaits`、`EvaluateLaneWait`、`GateCodeFactsHold`、`CriterionVerdictsHold`、`GateTargetLanes`、`ComputeLaneFactsHash`、`IsLaneStuckEligible`、`CrossLaneWaitsFor`、`LaneKeyOf`、`SyncLanes`
- ⑤ 状态机：`ExecuteLaneTickAsync`、`ClassifyParkedLanesAsync`、`EscalateLaneAsync`

**不搬（留在引擎，属通用或与 run 生命周期交织）**：`ExecuteReadyTasksAsync` 的 LanesEnabled 分流、`GenerateInteractionResponseAsync` 内 lane 分支、`SaveCheckpointAsync`（通用保存，幂等键含 laneKey）、`ApplyPendingContextPatchesAsync` 的 lane 重置段、`ExecuteToolTaskAsync` 的 park-expired lane 分支、`ReviewAsync` 的 lane 落账段、`TryReplanFromSupervisionAsync` 的 lane 守卫、`ValidateAndMaterializeGraph`、`MergeReplannedGraph`、`NormalizeTaskKey`、`InvalidTaskGraphException`。

### 三、关键设计决策
1. **partial 而非独立类**：lane 编排直接改写引擎 checkpoint、写事件、调模型工厂、创建实例、派发任务（约 15 类内部操作）；partial 让这些 private 成员在同 class 内互通，零接口成本、零调用改动。
2. **命名空间**：partial 部分必须与主文件同命名空间（`TinadecCore.DmaEA`）；`Orchestration/` 下新类型使用 `TinadecCore.DmaEA.Orchestration`（与既有 `OrchestrationDirectiveValidator` 一致），引用点补 using；JSON 序列化不受命名空间影响（契约形状不变）。
3. **LaneStatus 常量类**：用 `const string`（编译期内联、零运行时开销）承载 `planning/executing/waiting/gate_review/reviewing/finalizing/done/failed/completed` 等 lane 状态取值，实现时逐值核对源码，只替换字面量、不改值。
4. **分批搬运**：每批（按功能分组）搬完立即 `dotnet build TinadecCore.DmaEA.csproj`，把"搬漏依赖"暴露在最小上下文里；成员边界在分批后漂移，每批开工前用 [subagent:code-explorer] 重新定位精确边界与依赖清单。

### 四、不变量（不可破）
本轮零行为变更；契约面逐条不动：DTO 字段、DB 列与索引、事件名与 payload 键（`lane_key`/`waits[]` 等）、审批 lane 匹配规则、投影与前端、Gateway、OpenAPI 三件套（预期零漂移）；`RunFreezeGate` 的 `graph_tier_lanes_unsupported` 与 `InteractionsEndpoints` 的 409 映射保持现状。

### 五、验证与对账
- 抽取前基线（上一轮收口实测，直接引用）：AgentFramework 199/199、Governance 39/39、Architecture 14/14、Gateway 46/46、Desktop vitest 434/434 + vue-tsc 24 既有错误；Api 254 过 + 4 已知 git 环境红 + 2 负载敏感 flake（隔离复跑绿）。
- 抽取后重跑同矩阵逐项对比；`openapi.core.json`/`openapi.external.json`/`schema.d.ts` 以 `git status` 与 `npm run generate:client` 字节比对确认零漂移。
- 搬运保真自检：`git diff --stat` 与移动检测核对新增/删除行量级匹配（约 +1900/-1900 的净移动）。

### 六、风险与缓解
| 风险 | 缓解 |
|---|---|
| 分批搬运遗漏私有依赖 | code-explorer 边界清单 + 每批编译 + 编译错误驱动 |
| 常量替换误改值 | 逐值核对源码；`LaneModelContractTests` 钉住 LaneStatus 取值 |
| 命名空间迁移漏 using | 编译期发现，无行为风险 |
| lane 不可达导致回归覆盖偏弱 | lane 模型往返测试 + 既有 admission 测试（冻结闸在引擎外，不受搬迁影响）作为行为门禁 |
| diff 过大难审查 | 按功能分组提交前自检行数与移动保真 |

### 七、交付
- 文档：产品定义 §6.4.1 补记模块边界（lane 编排归属 `DmaEA/Orchestration/` 与 `FullDuplexRunEngine.Lanes.cs`）与"图档冻结期拒 lane"的事实；`AGENTS.md` 记录本轮并澄清"lane 与包零绑定、当前不可达、契约面在用"。
- 提交：延续按工组提交，WS-9 单独一个 commit（起点工作树干净，无需拆分）。

## Agent Extensions
### SubAgent
- **code-explorer**
  - Purpose: 搬迁前与每批搬运前，产出逐成员的精确边界（起始与结束位置）与依赖清单（该成员调用的其它引擎私有成员、读写字段），因为分批搬运会让行号漂移、成员边界需按当前源码重新定位。
  - Expected outcome: 每个待搬成员的边界与依赖清单，保证分批搬运零遗漏、零多余；并在搬运完成后复核 `FullDuplexRunEngine.cs` 中已无属于 Lanes 的成员残留。
