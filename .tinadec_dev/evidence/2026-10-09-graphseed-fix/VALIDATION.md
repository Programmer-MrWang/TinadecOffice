# GraphSeedPack 配置诊断与失败恢复验证（APP-PACKS-102）

日期：2026-10-09；基线 `d5e6c8d838f93f6bc26d4b7b77ecb0d9bdb9c2f3` + 当前工作树。Desktop/Gateway 本分工未写真实用户根、未改变 GraphSeedPack 版本/digest、未提交或推送。

## 本分工结果

| 门禁 | 结果 | 证据与层级 |
| --- | --- | --- |
| Desktop 6 个定向文件 | 89/89 passed | [desktop-final.log](desktop-final.log)：结构化 API error、两个请求包装、通知、400/412、显式重试、pending 共享、锁后/预览在途终态、新 peer 响应。fetch 与广播/锁均为受控测试替身。 |
| Gateway 映射与实际路由 | 23/23 passed | [gateway-diagnostics.log](gateway-diagnostics.log)：真实 Elysia app.handle，模拟 Core 响应，验证 preview/PUT diagnostics/code/trace 及私有扩展拒绝。 |
| Gateway 全量 | 最终97/97 passed，严格整数 schema 与快照门禁均通过 | [gateway-final.log](gateway-final.log)；早期全量见 [gateway-all.log](gateway-all.log)。 |
| Desktop 类型检查 | 最后任务 details 修正后再次passed，exit0 | [desktop-typecheck-final.log](desktop-typecheck-final.log)；此前通过记录见 [desktop-typecheck.log](desktop-typecheck.log) |
| Gateway 外部契约 / Desktop schema | 已同步生成 | [client-generation-final.log](client-generation-final.log)：缓存中的 openapi-typescript6.7.6，offline 执行。diagnostic line/column 是 integer，任意扩展没有进入定义。 |
| 真实 Core/Gateway + Electron UI | passed：400诊断、普通reconnect无preview/PUT、显式Retry201及reload inventory | [desktop-ui-acceptance.json](desktop-ui-acceptance.json)、[desktop-real-http-requests.json](desktop-real-http-requests.json)、[诊断截图](desktop-diagnostic.png)、[安装后截图](desktop-installed.png)。Electron43.3.0，实际最新组件源码、真实Core/Gateway，用户配置仅复制到owned temp；非完整打包App。 |

初次 Desktop 命令的 config/root 参数重复导致启动失败，随后新增测试漏传 options/idempotency 触发测试/类型门禁失败；已修复，原日志分别保留为 `desktop-command-startup-error.log`、`desktop-first-test-failure.log`、`desktop-first-typecheck-failure.log`、`desktop-second-typecheck-failure.log`。OpenAPI 第一次刷新新增诊断、随后严格整数替换 numeric-string coercion 的两次预期漂移分别保留为 `gateway-openapi-initial-drift.log`、`gateway-openapi-strict-initial-drift.log`；最终门禁单独记录，不能用漂移失败日志宣称通过。

收尾自审进一步实证同 key 的任务通知在成功重试后会保留上次失败 details（[失败回归](retry-task-details-regression.log)）。新尝试开始显式清旧 details，现有 Retry 测试增加“首次失败有诊断、成功后任务没有旧诊断”断言；修正后的最终89/89已写回 `desktop-final.log`。

## 隔离真实组件与服务验收

主任务使用owned temp中的九份用户配置副本，保留副本中原有Bootstrap测试包，启动真实Core/Gateway和Electron43.3.0。实际AgentPacksPanel、NotificationDetailDialog/Island组件为最新源码经Vite编译，基础CSS取已有build；本任务没有生产样式变更，因此该结果是组件与真实HTTP链路专项，不是完整打包App或安装器验收。

真实请求序列严格仅两次安装PUT：首次人为在副本植入两个draft重复项得到400 `configuration_invalid`，`configuration_unique`及trace进入通知诊断；恢复副本后显式Retry重新预览，第二次PUT返回201。两次普通reconnect没有新增preview/PUT，error没有被deferred覆盖。renderer reload后inventory可读取GraphSeedPack和副本原有Bootstrap测试包，持久安装事实从Core恢复。最终回执记录诊断可见与inventory内容，不以固定事件数量代替断言。原用户根不作为测试宿主，不清理任何既有包或用户配置。

## 变更与边界

- Core 的配置错误经 Gateway 精确错误码和窄诊断投影，到 Desktop ApiError，再进入通知 details；仅 code/message/severity/正整数行列及 trace_id 参与显示，不保留原始响应正文或任意扩展。
- 400 配置校验失败终止当前安装；仅真实409/412检查并发安装结果。普通 reconnect 保留失败，不再安装、不改成 deferred；用户 Retry 重新预览，经确认后一次PUT。
- 当前窗口 pending Promise 共享；同 origin peer 通过 gateway/user/包身份锁与 terminal broadcast/state_request 同步。广播是UI协调，不替代 Core 的幂等、发布/CAS 或授权。全部窗口退出后的内存失败状态不持久化；安装事实仍由 Core preview恢复。
- 四次真实失败已从既有 Core 日志确认。本次没有将其强行解释成广播 bug，也没有通过清空通知或删除真实配置掩盖后端原因。Core 过滤唯一索引与测试根隔离修复由主任务/Core 分工验收。
- 未执行完整 Vite build、三平台安装、真实模型或产品升级全闭环；APP-PACKS-001/101 不因本专项回归自动完成。
- 作用域内 `git diff --check` 通过，GraphSeedPack 制品目录 `git diff --exit-code` 零变化；未执行 reindex 或改根 AGENTS。

模块记录：[APP-PACKS-102](../../../docs/development-program/02-modules/app/agent-packs/TODO.md#app-packs-102)、[功能状态](../../../docs/development-program/02-modules/app/agent-packs/STATUS.md)。

## 主任务最终补证

主API程序集定向101/101（0跳过，15m56s），最新隔离helper独立重建后7/7（0跳过，32s）：[core-final.trx](core-final.trx)、[core-isolation-final.trx](core-isolation-final.trx)。临时Core真实进程退出、同根冷启动后，Gateway包查询200，GraphSeed3.0.1、Bootstrap0.1.0和原默认保持，见[进程重启回执](desktop-core-restart.json)。实际详情截图等待绘制，UI JSON记录可见的diagnostics/trace原文和两个包清单；不将renderer刷新算作Core重启。

最终[HTTP对账](desktop-http-verification.json)严格2PUT（400→201）。[真实用户配置前](user-config-before.json)/[后](user-config-after.json)九份TOML文件清单、字节数、SHA256一致；没有复制或编辑真实数据库、安全库或会话。完整结果与未验收平台见[总报告](../../reports/2026-10-09-graphseed-install-fix.zh-CN.md)。
