# Debug Studio 本机开发者开关：宿主实施与验证

日期：2026-10-09；基线 `d5e6c8d838f93f6bc26d4b7b77ecb0d9bdb9c2f3` 加当前工作树。Renderer/router/About/locales 由主任务独占实施，本记录限于 Electron 宿主。

## 实际契约

稳定 bootstrap 配置 `config/desktop.toml` 使用以下本机偏好：

```toml
[developer]
debug_studio_enabled = false
```

`electron/appConfig.cjs:30` 的 `loadAppConfig` 在 Gateway 被 `TINADEC_GATEWAY_URL` 管理时仍读取本机 TOML，返回原有 `gateway_url/source/managed/path` 及顶层 `debug_studio_enabled:boolean`。缺失时默认 false；`developer` 非表、开关非布尔或 TOML 语法无效均明确报错，不能静默启用。

`saveDebugStudioEnabled(configFile, enabled, env)` 仅接受布尔，先解析/校验既有文件，再修改该字段并使用同目录临时文件原子 rename。常见未创建表、普通/quoted 表、dotted key、inline table 通过局部源文本编辑保留字段、顺序和注释；候选结果必须重新解析并与预期文档严格相同，避免误改其它表、注释或 multiline string。特殊有效 TOML 形状回退既有 serializer，保留字段但可能无法保留注释。未重构其它配置保存接口。

| 宿主入口 | 返回/事件 | 边界 |
| --- | --- | --- |
| `tinadec:app-config` | 完整配置及既有 `storage` 来源信息 | 本次只复用 snapshot 返回结构 |
| `tinadec:debug-studio-enabled-save` | 保存后返回同一完整 snapshot | 必须同时为 `getMainWindow().webContents` 及 `isTrustedHostSender`；拒绝辅助窗口、不可信来源、子 frame |
| `tinadec:debug-studio-enabled-changed` | 向所有存活应用窗口发送，不携带 payload | 保存成功后刷新本机实际偏好；禁用时关闭已打开 Debug Studio |
| `tinadec:open-debug-studio` | `Promise<boolean>` | 同样仅可信主窗口；每次重新读取开关，false 直接返回 false，不创建窗口 |

preload 提供 `saveDebugStudioEnabled(enabled)` 与 `onDebugStudioEnabledChanged(callback)`。订阅回调不接收 IPC event/payload，返回 disposer，移除对应 listener。无私有凭据进入这个配置或事件。

## 验证

`electron/appConfig.test.cjs` 的 10 项包括原有 Gateway/TOML 回归，以及默认关闭、类型失败、受管 Gateway 偏好、字段/注释保存、quoted/dotted/inline/multiline 内容、无效保存与原子 rename 失败不破坏原文件。main IPC 和 preload 测试加载实际源代码，以 VM/stub 注册真实 handler，验证来源拒绝、开关新读取、完整 snapshot、无 payload 广播、禁用关闭和 disposer。

```text
node --test electron/appConfig.test.cjs
node --test electron/appConfig.test.cjs electron/storagePaths.test.cjs electron/trustedHostRequests.test.cjs
```

结果分别为 10/10、23/23，0 失败、0 跳过。日志：`debug-studio-host-tests.log`、`debug-studio-host-regression.log`。`appConfig.cjs/main.cjs/preload.cjs` 的 `node --check` 与本轮四个宿主源码/测试文件的 `git diff --check` 通过。

所有文件写入只发生在测试拥有的临时目录，main 依赖中的 storage/log/service 启动均为 fixture stub。未启动真实用户 Electron、未读取或改写真实配置、未运行大型构建、未提交或推送。这是宿主边界专项，不替代完整应用或真实 Electron 窗口验收。
