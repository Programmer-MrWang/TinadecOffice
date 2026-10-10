# 通用错误处理与恢复框架实施记录

日期：2026-10-10（Asia/Shanghai）。基线：main `84b9fefc` + 工作树。主责任务 [APP-HOME-107](docs/development-program/02-modules/app/home/TODO.md#app-home-107)。本轮没有提交或推送。

## 触发场景

用户删除测试遗留工作区时看到：

```
move project to trash failed
The registered project directory is unavailable.
trace_id: 0HNP6D5UUBC8P:00000011
```

该工作区同时不能删除、不能归档、不能加载。诊断确认这是三个独立缺口叠加，而不是一个缺陷：

1. **登记项指向已删除目录**。用户根 `state/projects.toml` 中有两条测试遗留（`skill`、`unsafe`），其 `project_root` 位于 `%TEMP%\tinadec-market-tests\…`，目录已不存在。
2. **挂载前置检查挡死全部路径**。[StorageScopeRegistry.cs](../../TinadecCore/Runtime/StorageScopeRegistry.cs) 的 `MountAsync` 首行 `Directory.Exists(scope.ProjectRoot)` 抛 `DirectoryNotFoundException`；归档/删除/读取都要先挂载，于是三条路一起失败。
3. **失败没有出口**。作用域中间件只回 `{code, trace_id}`，没有分类也没有动作；客户端只能显示一句通用文案，界面也不为坏登记项提供任何可执行操作。

## 实现

### Core

| 文件 | 变更 |
| --- | --- |
| `AspNetCore/ErrorClassification.cs`（新增） | 封闭分类（user_action_required / retryable / environment_unavailable / internal）与稳定动作标识；按错误码分类，未知码按状态码回退 |
| `AspNetCore/TinadecCoreHttpExtensions.cs` | 异常处理、ProblemDetails 定制、模型校验三处统一附加 `category`/`retryable`/`actions` |
| `AspNetCore/StorageScopeHttpExtensions.cs` | 作用域拒绝统一走分类；`storage_scope_unavailable` 带 `unregister_workspace`/`retry`/`open_storage_settings` |
| `AspNetCore/Endpoints/StorageEndpoints.cs` | 无法挂载的登记项仍列出，并携带同一分类字段（`availability_code`/`category`/`retryable`/`actions`） |

### Desktop

| 文件 | 变更 |
| --- | --- |
| `lib/apiError.ts` | `ApiError` 解析并暴露 `category`/`retryable`/`actions`/`canRetry`；未知分类与动作被丢弃；回退规则与 Core 一致 |
| `composables/useNotifications.ts` | `setErrorRecoveryHandlers` / `setErrorActionLabels`；错误通知按服务端动作标识自动挂载恢复按钮 |
| `controllers/HomeController.ts` | `installErrorRecovery()` 提供 retry / reload / unregister_workspace；恢复成功后清除整组失败字段 |
| `main.ts` | 入口注册动作文案与恢复处理器 |
| `locales/{zh-CN,en}.ts` | `errors.actions.*` 文案 |

## 验证

| 项 | 结果 |
| --- | --- |
| Core 契约（`UnavailableScope_AnswersWithAClassifiedRecoverableProblem`） | 已通过（59s）：真实 trash 请求在源目录删除并重启后返回 409，含 `storage_scope_unavailable` / `environment_unavailable` / `retryable=false` / `actions` 含 `unregister_workspace`+`open_storage_settings` / 非空 `trace_id` |
| Core 取消登记（`UnavailableRegisteredWorkspace_CanBeUnregisteredWithoutMounting`） | 已通过：不可用登记项可取消登记，磁盘数据保留，其他工作区不受影响 |
| Core 自由会话重命名（`FreeConversation_RenamesWithoutAProjectOrMode`） | 已通过：无项目会话的标题 PATCH 生效且可持久重读 |
| Desktop 错误契约（`apiError.test.ts`） | 6/6：分类/动作保留、未知值丢弃、回退一致、不可用识别 |
| Desktop 定向（AppSidebar + useWorkspaceList + HomeController + apiError） | 71/71 |
| 类型检查 | `vue-tsc --noEmit` 通过 |
| 真实页面 | 预览页正常加载，`#app` 渲染 73k 字符，无崩溃兜底，无控制台错误 |

## 本轮修正的错误

上一轮我在英文语言文件里用单引号包裹含撇号的字符串（`machine's`），未转义导致 `en.ts` 解析失败、Vite 整个前端启动失败。已改为双引号并确认 `vue-tsc` 与真实页面通过。这是本轮唯一的破坏性回归，与本框架无关，如实记录。

## 未覆盖边界

- Gateway 侧新增字段的 snapshot 断言未在本轮重跑；OpenAPI 快照未变更（字段为响应扩展，不进 schema）。
- 未逐个改写 78 个前端 `catch` 调用点；本轮只统一契约与自动恢复，调用点可逐步迁移到 `ApiError.canRetry`。
- 未在真实 Electron 打包应用、macOS/Linux 或 PostgreSQL 实库上复跑本轮契约。

## 第二轮：调用点迁移

上一轮统一了契约与自动恢复，但 78 个文件、297 个 catch 仍是旧写法。本轮先量化再迁移：

- 297 个捕获块中，48 个是空块、93 个已走通知、102 个写组件状态、14 个重抛、86 个其它。
- 抽查 48 个"空块"后确认多数是**有意的后台抑制**并带注释（如 `MarketController.refreshLedger` 的 12 秒轮询、`pendingAttachments.deleteQuietly`），不是缺陷；不逐个改动。
- 真正的问题集中在**把结构化错误压成一句字符串**的展示点。优先迁移了最高价值的两处。

### 迁移内容

| 文件 | 变更 |
| --- | --- |
| `composables/useErrorState.ts`（新增） | `toErrorState` 归一化任意 catch 输入；`useErrorState` 提供 `set`/`clear`/`message`；`recoveryActions` 只保留有处理器的动作 |
| `settings/sections/StorageSection.vue` | 17 个 `error.value = message(value)` → `failure.set(value)`；模板渲染原因 + diagnostics + trace_id + 动作按钮 |
| `components/WorkspaceEditorDialog.vue` | 3 个 catch 走 `failure.set`；抽出 `loadEditor()` 作为唯一读取路径，重试真实重跑读取而非关窗重开 |

### 验证

| 项 | 结果 |
| --- | --- |
| `useErrorState.test.ts` | 5/5：字段完整保留、归一化、响应式清除、只渲染可执行动作、未分类错误无动作 |
| 定向 6 文件（useErrorState / apiError / WorkspaceEditorDialog / StorageSection / AppSidebar / HomeController） | 81/81 |
| 类型检查 | `vue-tsc --noEmit` 通过 |
| 真实页面 | 正常加载（`#app` 73k 字符），无崩溃兜底，无控制台错误 |

### 仍未迁移

其余 76 个文件的 catch 保持原样。它们要么已走通知（契约会自动附带恢复动作），要么是后台抑制。
剩余工作是把展示型字符串改为 `useErrorState`，以及把 `Gateway` 新增响应字段补进快照断言。
