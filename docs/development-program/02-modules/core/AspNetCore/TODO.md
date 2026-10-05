# AspNetCore · 可嵌入 HTTP 层：TODO

模块ID：`CORE-HTTP` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本文件是该模块任务的唯一编辑入口；总TODO由本文件生成。任务ID长期稳定，完成或取消后保留记录；每项任务记录工作范围与验收条件。

状态：待核查 / 未开始 / 待方案 / 进行中 / 阻塞 / 待验收 / 已完成 / 不做 / 已被替代。优先级是初始建议，可在逐模块分析后调整。

<a id="core-http-001"></a>

### CORE-HTTP-001 完成 AspNetCore · 可嵌入 HTTP 层 的逐功能审计与模块图精化

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：CORE-HTTP
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

- [TinadecCore/AspNetCore/TinadecCore.AspNetCore.csproj](../../../../../TinadecCore/AspNetCore/TinadecCore.AspNetCore.csproj)

<a id="core-http-101"></a>

### CORE-HTTP-101 确认并补全审批响应契约登记

- 类型：核查
- 状态：待核查
- 优先级：P2
- 主责模块：CORE-HTTP
- 前置依赖：未细化；开工前在此列出实际Task ID，不能把全部关联模块当硬依赖
- 关联功能：待逐功能拆分后绑定本模块Feature ID
- 完成证据：未产生；本轮仅建立任务与源码基线

**问题与目的**

列表和详情响应端点未显式登记 DTO，OpenAPI/生成客户端对真实审批证据的覆盖需要确认。

**验收条件**

- [ ] 核对 /approvals 与 /approvals/{id} 当前快照能否表达真实响应及证据字段。
- [ ] 如缺失，登记真实响应类型并同步更新唯一 v1 快照、Gateway 映射和生成客户端；不新增兼容层。
- [ ] 生成类型应准确包含可选证据字段与状态，真实响应可按生成类型消费。

**初始证据**

- [TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs:70](../../../../../TinadecCore/AspNetCore/Endpoints/ControlPlaneEndpoints.cs#L70)
- [TinadecCore/tests/TinadecCore.Api.Tests/CoreOpenApiSnapshotTests.cs](../../../../../TinadecCore/tests/TinadecCore.Api.Tests/CoreOpenApiSnapshotTests.cs)

