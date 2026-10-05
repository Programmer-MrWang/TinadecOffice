# AgentGraph · 图与资源：TODO

模块ID：`CORE-AGENT-GRAPH` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="core-agent-graph-001"></a>

### CORE-AGENT-GRAPH-001 完成 AgentGraph · 图与资源 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：CORE-AGENT-GRAPH
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

已有职责投影和初始源码事实，还没有把每个用户/调用场景逐项拆分并完成实现、测试和运行证据对账。

**验收条件**

- [ ] 拆分STATUS.md中的聚合能力，每个功能分配稳定feature id、明确输入/输出、失败与权限边界。
- [ ] 逐条定位实际实现、活动测试和历史报告；把源码可见、历史验证与本轮验收分别记录。
- [ ] 至少明确成功、错误/取消、权限和持久化/恢复场景中哪些适用；未适用的写出理由。
- [ ] 精化ARCHITECTURE.md中的调用/数据流；每个有向关系提供源码依据，职责关联不冒充编译依赖。
- [ ] 将确认缺口登记独立TODO，写明目标行为、范围、前置依赖和可执行验收条件；无证据的保持待核查。

**初始证据**

- [TinadecCore/AgentGraph/AgentGraphModuleRegistrar.cs](../../../../../TinadecCore/AgentGraph/AgentGraphModuleRegistrar.cs)

<a id="core-agent-graph-101"></a>

### CORE-AGENT-GRAPH-101 将证据全文与检索摘要分离保存

- 类型：实现
- 状态：未开始
- 优先级：P1
- 主责模块：CORE-AGENT-GRAPH
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

证据正文写入时默认截断 64000 字符，超长报告无法保证完整回查。

**验收条件**

- [ ] 超长报告的全文以内容引用完整保存，摘要与原文使用不同字段及明确版本。
- [ ] 按权限可读完整原文，检索片段可定位原文及来源。
- [ ] 嵌入缺失或模型故障不影响原文读取；重建索引无需丢弃原文。

**初始证据**

- [TinadecCore/AgentGraph/EvidenceArchiveService.cs:89](../../../../../TinadecCore/AgentGraph/EvidenceArchiveService.cs#L89)

**历史任务映射**

- [docs/agent-graph/review-2026-10-01.zh-CN.md](../../../../agent-graph/review-2026-10-01.zh-CN.md)：N8：证据与上下文治理；只作来源，不继承完成勾选
- [docs/agent-graph/todo.zh-CN.md](../../../../agent-graph/todo.zh-CN.md)：N8. 全文与上下文角色闭环；只作来源，不继承完成勾选

<a id="core-agent-graph-102"></a>

### CORE-AGENT-GRAPH-102 设计任务级多目标资源与远程 provider 契约

- 类型：方案
- 状态：待方案
- 优先级：P2
- 主责模块：CORE-AGENT-GRAPH
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

现有 resolver 只支持明确本地目标；多 worktree 缺任务绑定、remote/cloud 无 provider 绑定。

**验收条件**

- [ ] 明确 run/task/worktree/environment 的绑定模型和唯一执行目标选择规则。
- [ ] remote/cloud/browser 声明实际执行 provider、认证边界和取消/恢复语义。
- [ ] 任何多义或不支持目标明确拒绝，不能静默退回项目根。
- [ ] 执行证据可定位实际机器、provider 与工作目录。

**初始证据**

- [TinadecCore/AgentGraph/ToolExecutionTargetResolver.cs](../../../../../TinadecCore/AgentGraph/ToolExecutionTargetResolver.cs)

**历史任务映射**

- [docs/agent-graph/review-2026-10-01.zh-CN.md](../../../../agent-graph/review-2026-10-01.zh-CN.md)：N7：环境与沙箱；只作来源，不继承完成勾选
- [docs/agent-graph/todo.zh-CN.md](../../../../agent-graph/todo.zh-CN.md)：N7. shell 沙箱与资源到执行的绑定；只作来源，不继承完成勾选

