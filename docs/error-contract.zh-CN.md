# 错误处理与恢复契约

适用：2026-10-10 工作树。功能与验收进度唯一归属 [APP-HOME-107](development-program/02-modules/app/home/TODO.md#app-home-107)。本文件定义产品错误契约；实现证据见 [本轮报告](../.tinadec_dev/reports/2026-10-10-error-recovery.zh-CN.md)。

## 为什么要统一

一次真实的失败：用户删除一个工作区，界面只显示 “The registered project directory is unavailable.”，随后这个工作区不能删除、不能归档、也不能加载。原因是三种不同的信息缺失同时发生：

1. 响应只说“哪里错了”，不说“谁能修、下一步做什么”；
2. 客户端拿不到机器可读的分类，只能把失败显示成一句通用文案；
3. 失败状态没有出口——坏掉的登记项没有任何可执行动作。

统一契约解决的是这三件事，而不是某一个错误码。

## 两个轴

每个失败都在两个轴上被分类：

| 分类 | 含义 | 重试同一请求 |
| --- | --- | --- |
| `user_action_required` | 需要人改点什么（改配置、选目录、登录） | 会再次失败 |
| `retryable` | 稍后重试可能成功（锁被占用、并发冲突、对端忙） | 可能成功 |
| `environment_unavailable` | 本机依赖缺失或不可达（登记的目录被删、工具没装、后端未起） | 需要先修复环境 |
| `internal` | 未预期的缺陷 | 可重试，但应上报 |

分类是封闭集合，客户端只按分类分支，不追逐单个错误码。因此新错误码出现时也会落到合理的一类，而不是“未知”。

## 恢复动作

响应可以列出稳定动作标识，客户端负责文案和行为：

`retry`、`reload`、`open_settings`、`open_storage_settings`、`open_tool_settings`、`unregister_workspace`、`choose_folder`。

客户端只认识上表；未知动作被忽略，不能注入未预期的行为。服务端不下发面向用户的文案。

## 响应形状

所有 *problem 响应*（异常处理、模型校验、作用域中间件）都带这些字段：

```json
{
  "type": "https://tinadec.dev/errors/storage_scope_unavailable",
  "title": "storage_scope_unavailable",
  "status": 409,
  "detail": "The registered project directory is unavailable.",
  "code": "storage_scope_unavailable",
  "category": "environment_unavailable",
  "retryable": false,
  "actions": ["unregister_workspace", "retry", "open_storage_settings"],
  "trace_id": "0HNP6D5UUBC8P:00000011",
  "instance": "/api/v1/projects/{id}/trash"
}
```

配置类错误额外携带结构化 `diagnostics`（文件、行、列、码、严重级别）。

## 数据行也遵循同一契约

工作区列表里无法挂载的登记项不会消失，而是带同样的分类字段：

```json
{
  "id": "…", "storage_id": "…", "name": "skill",
  "availability": "error",
  "availability_error": "The registered project directory is unavailable.",
  "availability_code": "storage_scope_unavailable",
  "category": "environment_unavailable",
  "retryable": false,
  "actions": ["unregister_workspace", "retry", "open_storage_settings"]
}
```

这样侧栏可以直接为这一行提供出口（重新加载 / 取消登记），而不是让整行变成死路。

## 各层职责

| 层 | 职责 |
| --- | --- |
| Core | 产生码与诊断；`ErrorClassification` 决定分类与动作；异常处理与作用域中间件补齐字段 |
| Gateway | 保留码、分类、动作、trace_id、diagnostics，不改写为通用 conflict |
| Desktop `ApiError` | 解析契约、过滤未知动作、`category`/`retryable`/`actions`/`canRetry` |
| Desktop 通知 | 按动作标识查一次注册的处理器，自动给错误通知挂上恢复按钮 |
| 视图 | 决定按钮文案与落点（设置页、侧栏行），不下沉业务逻辑 |

## 恢复入口的注册

`setErrorRecoveryHandlers` 与 `setErrorActionLabels` 在应用入口各调用一次；`HomeController.installErrorRecovery()` 提供 retry / reload / unregister_workspace 的实现。同一失败只显示第一个可用动作——同时给“重试”和“重新加载”会让人无从区分。

## 边界

- 5xx 默认分类为 `internal` 且可重试；4xx 默认 `user_action_required` 且不标注可重试。
- 未知分类与未知动作被丢弃，回退到按状态码推断，不信任上游任意字符串。
- `retryable` 表示“同一请求可能成功”，不承诺幂等；写操作仍按各自语义返回 409/412。
- 契约不改变任何已有错误码、幂等、ETag 或审批流程。
