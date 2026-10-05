# TinadecOffice 项目长期笔记

## 终端能力架构（2026-08-31 定案）
- 双通道：用户终端 = Electron 直连 PTY（node-pty，`electron/terminalManager.cjs`）；agent 终端 = tool-core-gateway 路径（TinadTools `shell` 工具 → TinadCore 治理 dispatch → run 事件日志 → Desktop 回放+follow）。
- 管道协议 v2 有非请求响应的事件行 `{"kind":"event","call_id":N,...}`，call_id<=0 是广播（长驻会话输出/退出），由 `TinadecToolsProcessManager` 分流、`TerminalSessionEventBridge` 按 terminal_session_id 归属回写 run。
- 面板复用 terminal tab（AGENT 徽标来源标记）；对话内 shell 调用渲染 `TerminalCallBlock.vue`，跳转用 `openAgentTerminal`（幂等，`agent:<sessionId>` 实例 id）。
- 已知后续项：无 ConPTY（仅管道重定向）；长驻升级目前只认显式 `long_lived:true` 参数（自动升级未做）；Gateway `/ws/terminal` 桩未启用（SSE 已够用）。

## 环境硬约束
- **TinadTools 宿主禁用反射序列化**（`JsonSerializerIsReflectionEnabledByDefault=false`）：动态 JSON payload 必须用 `Utf8JsonWriter` 手写或 source-gen context（`ShellToolJsonContext` 等），否则运行时 InvalidOperationException。
- **TinadTools 协议冒烟**：`scripts/terminal_protocol_smoke.py`（驱动真实子进程验证 one-shot/长驻/控制/事件顺序）。
- **TinadecTools.Tests 7 个失败为环境性**：Windows 符号链接创建无权限（CreateSymbolicLink 激活上下文错误），GitReadTools/GitLogTools 的 link-traversal 用例，与功能改动无关。
- **openapi 快照自愈流程**（Core 与 Gateway 均已改为"先写后断言"）：跑测试 → 快照自动再生成 → `git diff --exit-code` 把关 → 有意变更则提交快照。
- **本仓库 .git 曾于 2026-08-31 严重损坏**（.pack 全丢、refs 丢失），已从 origin (github.com/Tinadec/TinadecOffice) 完整重建；修复流程见 `.workbuddy/memory/2026-08-31.md`。对 .git 的批量写操作（stash/rebase 等）建议谨慎、必要时脱离沙箱执行。
