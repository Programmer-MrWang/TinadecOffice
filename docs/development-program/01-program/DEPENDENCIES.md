# 跨模块关系与任务依赖

总图中的关联不是开工依赖。本文件记录已核对的架构边界与待细化工作簇；每个实现任务的硬前置必须在模块TODO中列真实Task ID。

| 工作簇 | 建议主责 | 必须联合分析的模块 | 已知边界 |
| --- | --- | --- | --- |
| 用户消息与执行子run | CORE-DMAEA | CORE-LIFECYCLE / CORE-RUNTIME / CORE-TOOLS / CORE-GOVERNANCE / CORE-AGENT-GRAPH / APP-HOME | 父子字段/级联基础已有，派发尚未创建完整执行子run；不能把两者合并算完成 |
| 全文证据与上下文治理 | CORE-AGENT-GRAPH / CORE-CONTEXT | CORE-VECTOR / CORE-MEMORY / CORE-PROMPTS / CORE-LOOP-GUARD | 证据混合回查与Memory关键词检索是不同路径 |
| 执行者组织通信 | CORE-TINACHAT | CORE-RUNTIME / CORE-DMAEA / APP-DATA | 当前wake注入已有，专用turn/回复确认/离线转移仍待分析 |
| 模型与配置闭环 | CORE-MODELS / CORE-AGENT-CONFIG | APP-SETTINGS / APP-PACKS / GW-CONFIG / CORE-CONTEXT | 发布版本冻结与真实提供方参数/取消验收分开 |
| 编辑器生产worker问题 | APP-CODE | APP-RENDERER / APP-WEB | 历史报告问题需在当前production bundle复验后实施 |
| 审批契约响应登记 | CORE-HTTP | CORE-CONTRACTS / X-QUALITY / GW-CONFIG / APP-HOME | 任务由Core HTTP层持有，其他模块不建立重复缺口任务 |
| 平台沙箱/终端 | TOOLS-SANDBOX / TOOLS-COMMAND | CORE-TOOLS / APP-DESKTOP / X-DELIVERY | Desktop用户PTY与智能体工具终端分别验收 |
| Manager注册交接 | APP-SERVICES | X-DELIVERY / APP-PACKS / CORE-AGENT-CONFIG | App当前只读内置runtime；机器注册不是Core工作区安装状态 |
| WebSocket用途 | GW-WS | APP-DEBUG / GW-HTTP | 现有两条终端不依赖WS；先明确产品用途再决定实施/退役 |

编译依赖以Core各模块ARCHITECTURE中的ProjectReference为准，业务调用通过端口/组合根。实现任务需要的API/数据模型变化在任务开始时具体化。
