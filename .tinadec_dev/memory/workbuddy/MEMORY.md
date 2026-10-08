# TinadecOffice 项目长期笔记

## 终端能力架构（2026-08-31 定案）
- 双通道：用户终端 = Electron 直连 PTY（node-pty，`electron/terminalManager.cjs`）；agent 终端 = tool-core-gateway 路径（TinadTools `shell` 工具 → TinadCore 治理 dispatch → run 事件日志 → Desktop 回放+follow）。
- 管道协议 v2 有非请求响应的事件行 `{"kind":"event","call_id":N,...}`，call_id<=0 是广播（长驻会话输出/退出），由 `TinadecToolsProcessManager` 分流、`TerminalSessionEventBridge` 按 terminal_session_id 归属回写 run。
- 面板复用 terminal tab（AGENT 徽标来源标记）；对话内 shell 调用渲染 `TerminalCallBlock.vue`，跳转用 `openAgentTerminal`（幂等，`agent:<sessionId>` 实例 id）。
- 已知后续项：无 ConPTY（仅管道重定向）；长驻升级目前只认显式 `long_lived:true` 参数（自动升级未做）；Gateway `/ws/terminal` 桩未启用（SSE 已够用）。

## 桌面端窗口与本地资源（2026-10-08 定案）
- 打包态渲染层**不再用 `loadFile`**：由注册为 standard+secure 的 `app://bundle` 承载 `dist/`（`electron/appBundle.cjs`，含路径穿越防护/MIME/`/`→`index.html`）。四个窗口（main/panel/pet/debug-studio）的 `webSecurity` 已恢复默认，**不要再加回 `webSecurity:false`**——它会让预览面板里的异源 iframe 读到 `contextBridge`（含终端 IPC）。
- 用户本地媒体（背景图/视频）走 `tinadec-media://local/<base64url path>`（`electron/localMedia.cjs`）：只服务图片/视频扩展、支持 Range、**不发 CORS 头**。渲染层编码在 `useBackground.normalizeFileSource`（与主进程解码有跨语言往返用例），`read-image-data-url` 经 `sourceToMediaPath` 兼容三种形式。**网关 CORS 必须放行 `app://bundle`**，否则打包态请求被拒。
- 终端 IPC 不可再放开：`terminal:create` 只认 shell 目录内的条目、argv 取目录值、id 服务端生成；write/resize/destroy/snapshot 校验 sender 归属。
- 外链统一走 `electron/externalLinks.cjs`（`setWindowOpenHandler` + `will-navigate`，仅 http/https 交给系统浏览器）。

## 依赖行为判据（别照抄 issue/文档的结论）
- **elysia 1.4.29 会自己钳制 2xx**：`dist/compose.js` 的路由 catch 里 `if(!set.status||set.status<300)set.status=error?.status||500`。所以"路由暂存 201 后出错 → 响应 201"这类指控**默认先复现再采信**；但 4xx/5xx 会被保留。
- 网关上游不可达必须回 **502**（`src/upstreamFailure.ts`），且**不能**走 `toProblemDetails`（`normalizeCode` 会把 code 抹成 `conflict`，丢掉 `CORE_UNREACHABLE` 指纹）。`TINADEC_GATEWAY_TIMEOUT_MS` 至今无人消费。
- 桌面端 `package.json` 的 `test` 脚本是**显式文件清单**：新增 electron 测试文件必须同时加进那一行，否则静默不跑。

## 环境硬约束
- **TinadTools 宿主禁用反射序列化**（`JsonSerializerIsReflectionEnabledByDefault=false`）：动态 JSON payload 必须用 `Utf8JsonWriter` 手写或 source-gen context（`ShellToolJsonContext` 等），否则运行时 InvalidOperationException。
- **TinadTools 协议冒烟**：`scripts/terminal_protocol_smoke.py`（驱动真实子进程验证 one-shot/长驻/控制/事件顺序）。
- **TinadecTools.Tests 7 个失败为环境性**：Windows 符号链接创建无权限（CreateSymbolicLink 激活上下文错误），GitReadTools/GitLogTools 的 link-traversal 用例，与功能改动无关。
- **openapi 快照自愈流程**（Core 与 Gateway 均已改为"先写后断言"）：跑测试 → 快照自动再生成 → `git diff --exit-code` 把关 → 有意变更则提交快照。
- **本仓库 .git 曾于 2026-08-31 严重损坏**（.pack 全丢、refs 丢失），已从 origin (github.com/Tinadec/TinadecOffice) 完整重建；修复流程见 `.workbuddy/memory/2026-08-31.md`。对 .git 的批量写操作（stash/rebase 等）建议谨慎、必要时脱离沙箱执行。
