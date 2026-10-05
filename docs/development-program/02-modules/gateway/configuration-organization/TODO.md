# Gateway / 配置、市场、治理与组织代理：TODO

模块ID：`GW-CONFIG` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="gw-config-001"></a>

### GW-CONFIG-001 完成 Gateway / 配置、市场、治理与组织代理 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：GW-CONFIG
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

- [TinadecGateway/src/index.ts](../../../../../TinadecGateway/src/index.ts)
- [TinadecGateway/src/organizationRoutes.ts](../../../../../TinadecGateway/src/organizationRoutes.ts)

<a id="gw-config-101"></a>

### GW-CONFIG-101 验收配置 revision 与真实市场查询透传

- 类型：验收
- 状态：未开始
- 优先级：P2
- 主责模块：GW-CONFIG
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

历史存在市场参数拼写错误被 mock 测试掩盖；当前已修源码需要真实端点验证，并检查配置 revision 的真实链路。

**验收条件**

- [ ] 同一配置经直接 Core 与 Gateway 写读一致，ETag/If-Match 与过期冲突正确
- [ ] 市场 q/source_id/limit/offset 在真实目录产生预期过滤和分页
- [ ] AgentPack 幂等头、安装 receipt 与 ProblemDetails 不丢失

**初始证据**

- [TinadecGateway/src/index.ts](../../../../../TinadecGateway/src/index.ts)
- [TinadecGateway/src/marketProxy.test.ts](../../../../../TinadecGateway/src/marketProxy.test.ts)
- [TinadecGateway/src/runtimeProxy.test.ts](../../../../../TinadecGateway/src/runtimeProxy.test.ts)

<a id="gw-config-102"></a>

### GW-CONFIG-102 验收组织可见性与治理拒绝的真实透传

- 类型：验收
- 状态：未开始
- 优先级：P2
- 主责模块：GW-CONFIG
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

生成路由和契约存在，不代表真实身份可见性、静音和审批 gate 数据已经验收。

**验收条件**

- [ ] 非角色访问/决策得到 Core 原始拒绝状态与代码
- [ ] 组织、拓扑、证据、审批 gate 的 query/body 均实际生效
- [ ] 成员可见性配置与静音变化在通过 Gateway 的读面正确呈现

**初始证据**

- [TinadecGateway/src/organizationRoutes.ts](../../../../../TinadecGateway/src/organizationRoutes.ts)
- [TinadecGateway/src/tinaChatRoutes.ts](../../../../../TinadecGateway/src/tinaChatRoutes.ts)

