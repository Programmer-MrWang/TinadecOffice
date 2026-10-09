# Renderer Debug Studio 偏好行为回归

日期：2026-10-09。只新增测试，不修改生产 useDebugStudio、AboutSection、router、Sidebar、Electron 或共享样式。

新增文件：

- `apps/desktop/src/composables/useDebugStudio.test.ts`：每个用例通过 `vi.resetModules` 隔离真实模块，mock Electron host I/O。验证默认 hidden、严格 true 才启用、无 host、并发共享单次 pending read、读取错误关闭且可重新加载、保存失败保持既有状态、保存成功只采信 host 返回、跨窗口变更重新读取、变更不被已有 pending read 丢弃、已完成 save 不被旧 read 覆盖、保存与队列 refresh 交错后再次读取 host 最新值。
- 同文件使用真实 router.push、beforeEach、enabled watcher，只有 Home/Spatial/Debug 的页面组件 module 使用轻 stub；验证 disabled 或 read failure 时 direct `/debug-studio` 转 home，enabled 可进入且跨窗关闭后离开，`/workbench` 仍转 `/space` 且不读取 Debug 配置。
- `apps/desktop/src/settings/sections/AboutSection.debug.test.ts`：真实 AboutSection + UiSwitch + composable。验证读/写 pending 期间按钮 disabled 且不乐观改 checked；保存失败 checked 保留、可明确 retry；读取失败隐藏/阻止启用，跨窗成功 refresh 后恢复。仅 stub 无关 BrandLogo。

两种读取竞态由审源码确认并向 root 报告，root 在首次运行前已经加入 revision / refreshRequested 修复，因此没有旧生产版本红转绿实证，本记录不虚构失败。

## 实际运行

从 `apps/desktop`：

`npx vitest run src/composables/useDebugStudio.test.ts src/settings/sections/AboutSection.debug.test.ts --reporter=verbose`

最终 exit 0，2 文件 / **19 测试通过，0 skip**，21:56:21 开始，Vitest 耗时 7.60s。输出 `debug-preference-final.log`。之前18项通过读数保留 `debug-preference-18.log`；组合 save+queued-refresh 的第19项补齐后最终再次通过。

首次 composable+router 单文件 15/15 通过，`debug-preference-initial.log`。About fixture 的无关 Vapor BrandLogo 挂载曾失败，随后添加 vaporInteropPlugin 又遇当前 Vitest CJS/ESM runtime 的 `simpleSetCurrentInstance` 错误；原始两次失败保留 `debug-about-fixture-interop-failed.log` / `debug-about-fixture-vapor-plugin-failed.log`。最终只隔离该品牌图标，实际开关、设置保存和路由守卫均未 stub，19项通过。

未运行统一 typecheck / 大构建；由 root 协调。以上为 Renderer 控制流回归，不等于 Electron IPC持久化、重启、多真实窗口或全平台验收；这些由 peer/root 的专项证据补充。
