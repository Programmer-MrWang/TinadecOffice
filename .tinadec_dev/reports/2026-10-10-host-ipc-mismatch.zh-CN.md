# 2026-10-10 宿主 IPC 版本不一致修复

任务唯一入口：[APP-HOME-107](../../docs/development-program/02-modules/app/home/TODO.md#app-home-107)。本次接续 [接口回归修复](2026-10-10-interface-regression.zh-CN.md)，只处理旧 Electron main 与新 preload/renderer 混用时的本地错误和恢复接线，不改 Core/Gateway、包版本、安装规则或用户数据。

## 根因与现场边界

用户报错是 `No handler registered for 'tinadec:host-status'`，发生在 renderer 调用本地 Electron IPC 时，业务请求尚未到达后端。上一轮新增宿主就绪接口后，缺少这类版本不一致的错误处理，因此被两套 API wrapper 包装成 `Cannot connect to backend`，Home 又重复报初始读取失败。

只读核查显示用户 main PID 43656 于 **2026-10-10 14:45:53（UTC+8）** 启动；preload、hostConnection 和 main 源文件分别在 15:26:10、15:28:19、15:49:48 更新。当前源码在创建窗口之前同步注册两个状态 handler，开发启动器只启动一次 Electron，没有 main/preload watcher。现场与“旧 main 仍运行，页面重载使用新接口”一致。本次没有读取进程内 JavaScript 内存，结论依据错误、进程时间及注册顺序；详见 [现场摘要](../evidence/2026-10-10-host-ipc-mismatch/process-source-snapshot.json)。

## 产品变化

- `hostConnection` 统一状态读取和重试：既有 bridge 缺方法或这两个 IPC 缺 handler → `restart_required / desktop_restart_required`；其他 IPC 故障 → `unavailable / host_bridge_unavailable`。不降级为 ready/preview，不把原始异常文本传给界面。
- `hostAccess` 先撤权再抛结构化 ApiError，客户端状态 503、environment_unavailable、retryable=false。版本不一致缓存后不重复调用 IPC；API 普通请求及 AgentPack ETag 请求均保持分类，fetch 调用为零。取消与迟到读取保护保留。
- `useConnection` 立即结束无效启动计时器/健康轮询，拒绝无意义手动重试。复审补齐手动 retry 的 revision guard，较新的宿主广播优先于旧成功或失败回执，防止迟到 ready 覆盖撤权。
- App 清除误报的 backend-connection 警报，不启动 GraphSeedPack 检查；Home 将该类本地失败交给共享 Banner，不重复发项目、doctor、readiness 三类初始错误。已有事实与流游标保留，恢复只读取，不重放创建、保存或安装。
- Banner 复用现有材质与 UiButton。DEV 显示关闭开发进程后从仓库根重新 `npm run dev`，无自动重启按钮；生产保留可信 restart IPC、单飞等待与调用失败后的手动关闭重开指引。

开发态不能调用旧 main 的 `app.relaunch` 代替整链启动：Desktop launcher 收到 Electron exit 会停止 Vite，根 concurrently 会停止同组服务；独立 relaunch 也不能重新取得开发启动链凭据。本次未新增 watcher，未自动停止/重启用户进程，未向 renderer 提供凭据。

## 验证与证据

所有测试使用夹具或独立临时用户根，未改真实用户配置、数据库、包或工作区登记；用户 `.gitignore` 保持原字节且不进入提交。

| 验证 | 结果及范围 |
| --- | --- |
| 初始 helper / gate / connection | 3 文件 26/26 |
| 核心分类、Banner、App、Home、两套 API wrapper | 8 文件 120/120；在后续 retry 时序补丁之前执行 |
| retry 时序补丁 | useConnection 19/19，新增 4 个迟到/广播优先用例 |
| 读取/流/工作区/设置回归 | 8 文件 55/55；首次 3 个 SearchNavigation 夹具缺 getter，补齐测试 bridge 契约后通过，未放松产品准入 |
| AgentPack 实际相关文件 | SettingsPage.agentPack、graphSeedPackBootstrap、agentPackApi 共 3 文件 22/22；真实安装属于前一报告，本轮未重复安装 |
| 最终 Desktop 全量 | 135 文件通过 / 1 既有跳过；1241 项通过 / 14 既有跳过，exit 0，527.50 秒；Node 提示和 happy-dom teardown AbortError 诊断未造成测试失败 |
| 最终类型检查 | npm run typecheck / vue-tsc --noEmit，exit 0 |
| 最终生产构建 | Vite exit 0，6436 modules，14m 1s；保留 VueUse annotation、UIE barrel circular chunk 和大于 500 kB chunk 提示；不等于运行/安装验收。首次在 peer 发现时序缺口后取消，只计最终源码构建；详见 [机器可读验证摘要](../evidence/2026-10-10-host-ipc-mismatch/verification-tests.json) |
| Windows Electron 43.3.0 | [accepted=true](../evidence/2026-10-10-host-ipc-mismatch/electron-acceptance.json)，真实 main/preload/IPC/生产 helper、gate、connection 和 Banner；实际重启与服务身份替代边界如下 |

Electron 夹具仅跳过两个状态 handler 的注册，真实 preload 产生与用户相同的缺 handler 异常。helper 返回 restart_required，业务 gate 阻断，health_reads=0。生产 Banner 实际点击到达既有 restart IPC，但 app.relaunch/exit 被拦截计数一次，未真正重启；DEV Banner 无按钮、明确 npm run dev 指引。恢复当前 main 注册并重载，状态为 ready/connected，Banner 隐藏。截图及可复跑源码见 [证据说明](../evidence/2026-10-10-host-ipc-mismatch/README.zh-CN.md)。

该 Electron 夹具没有启动/查询 Core 或 Gateway，服务身份、生命周期、ready 后 health 为替代；截图使用已有 dist 基础 CSS 和当前组件 scoped CSS，不是完整生产 App 截图。初轮静态 bundle 环境 define、Vue snapshot 克隆与 scoped CSS 读取问题仅修夹具，失败 JSON 保留，不算产品缺陷。所有 owned 进程已结束，用户 PID 43656 未动。

## 交付与仍需操作

正式 [错误契约](../../docs/error-contract.zh-CN.md)、根/Desktop AGENTS 与 Home、Desktop shell、local-services、shared-renderer 模块记录已更新。继续沿用 APP-HOME-107 待验收，不建立新进度入口，不将局部夹具/编译折算完整 App、安装器、Linux/macOS 或 PostgreSQL 的本轮验收。

已启动的 main 不会因源文件保存而更新。恢复步骤为关闭原整组开发进程，再在 `C:\git\agent\TinadecOffice` 执行 `npm run dev`。这不是清空数据或重装；新启动读取原数据。此次没有替用户执行该重启，也不声明其当前应用已经恢复。

提交前只读核查发现原 PID 43656 已退出，新仓库 Electron 主进程 PID 7160 于 **2026-10-10 17:56:10（UTC+8）** 启动。新进程存在不证明当前窗口已认证或业务已恢复；若错误已消失，无须重复执行重启。验证摘要保留这两个观察时点，未读进程环境。

代码提交：`5c799714`（Desktop IPC 分类、撤权、恢复提示与时序回归）；文档和证据另组提交，不 push。
