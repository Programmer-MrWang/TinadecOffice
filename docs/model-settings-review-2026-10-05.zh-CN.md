# 模型设置与命令审批链路复查（2026-10-05）

本轮从 Desktop 发起交互，沿 Gateway、Core 冻结配置、权限包络、工具审批和 SDK 请求逐段检查。验证使用当前共享工作树；原有模型宿主迁移、个人设置等改动保留，未把这些改动算成本轮功能。

## 已定位并修复

| 问题 | 原因与修复 | 验证 |
| --- | --- | --- |
| 首次发送的权限选择可能变化 | `HomeController.handleSend` 原来在等待创建会话后才读取权限；现于第一次异步等待前记录发送时的选择。 | 创建会话期间把输入框从 full-access 改为 default，实际请求仍携带 full-access。 |
| 排队消息转并列执行重新要求审批 | 排队卡只保存文字和交互 ID；`promoteQueued` 重发时丢失权限、模式和模型。现在卡片保留这些选择以及附件 ID，晋升时原样交给 Core。 | 真实发送→排队→切换当前选择→并列，断言请求仍携带原权限/模式/模型。 |
| 模型参数只有默认常量 | 新增按提供方版本保存的 `model_parameters`，以模型 ID 为键；两条模型解析路径都读取它，SDK 工厂在流式和普通调用中应用配置。 | HTTP 保存/读取/清空；普通解析；冻结旧版本后修改参数，旧运行仍取旧值；真实 SDK 请求体检查。 |
| 提供方编辑可能丢掉协议 | `apiConnectionProvider` 和汇总投影没有带上 `protocol`，表单只能重新推断。现同时保留协议和参数。 | 双向投影测试，设置页展开后显示原有思考强度和输出上限。 |
| 添加模型失败仍关闭弹窗 | 保存函数吞掉异常，调用方无条件关闭弹窗；还会把默认模型改成模型列表第一项。现在保存返回成功标志，失败保留待添加项，并保留已有默认模型。 | 整页测试模拟保存失败，弹窗和待添加模型仍在。 |
| 删除模型修改了其他提供方 | 删除逻辑只比较模型名，写路由没有 If-Match，还会尝试保存空候选链。现在匹配提供方＋模型，预检查全部受影响路由，携带各自 revision；唯一候选需要先选择替代模型。 | 同名模型跨提供方回归；空链预检查；已有路由版本守卫。 |
| 刷新失败被显示成空列表 | 提供方与路由请求失败被 catch 成 `[]`。现在保留原数据并显示可重试的失败通知。 | 整页测试模拟离线刷新，模型列表仍显示。 |
| 权限选择缺少可判读说明 | 默认、自动审批和完全访问没有说明，菜单也缺键盘语义。现在显示各档实际行为及“后续消息生效”，支持菜单选中状态、方向键、Home/End、Escape 和焦点返回。 | DOM 与键盘测试。 |
| 模型行按钮裁切 | 原四列网格不能容纳新增入口。模型操作改为同一组可换行按钮，参数在当前模型下展开。 | Electron 宽窗/窄窗截图与整页组件测试。 |

## 参数契约

沿用 `PUT /api/v1/model-providers/{id}` 与 If-Match，不另建一套状态或数据库表：

```json
{
  "model_parameters": {
    "model-id": {
      "reasoning_effort": "high",
      "temperature": 0.3,
      "top_p": 0.8,
      "max_output_tokens": 8192
    }
  }
}
```

- 思考强度：默认（省略字段）、none、low、medium、high、xhigh。当前 Microsoft.Extensions.AI 10.8 的枚举覆盖这五档；仅为 OpenAI Chat / Responses 开放此设置。Anthropic 与本地 harness 的专属思考控制不冒充已实现。
- 温度：0–2，Anthropic 协议为 0–1。Top P：0–1。输出上限：正整数。未知字段、错误类型、越界值均返回 `400 invalid_model_parameters`，校验发生在改凭据和保存版本之前；Gateway 保留该错误码。
- 未配置值沿用现有默认。删除某模型的参数项可恢复默认；编辑一项保留其他模型的参数。Core 冻结提供方版本，所以修改只影响之后的新运行。
- 自定义输出上限替代标准的 4096 默认；探针、审批审查员、结构化解释等专门调用的其他显式上限仍作为上限，不能被更大的模型默认值放大。
- 已选择推理档位的已知 OpenAI 推理模型不发送 temperature / top_p，界面同时禁用并解释这两个字段。支持哪些档位最终取决于提供方和模型，[OpenAI 官方推理文档](https://developers.openai.com/api/docs/guides/reasoning)明确说明该差异；[Claude Messages 文档](https://platform.claude.com/docs/en/api/messages/create)也按模型限定采样参数。本轮没有真实供应商调用的兼容性保证。

## 完全访问的真实边界

Core 原本已有两段无人值守授权：`GovernanceService.UnattendedPermissionReleaseReasonAsync` 放行资源权限包络；`ToolApprovalCoordinator.TryMintPreAuthorizedApprovalAsync` 将冻结 full-access 的工具审批铸造成可消费授权。它仍执行工作区、工具清单、参数哈希和执行绑定检查。

`UnattendedEndToEndTests.FullAccess_EndToEnd_GitCommitWithoutHuman` 本轮亲自通过：脚本模型驱动真实 TinadecTools 子进程执行 shell 并完成真实 Git 提交，没有人工决定。此证据覆盖 Core 治理的命令链路。已经启动的运行仍使用自己的冻结权限；更改输入框选项不会追溯修改它。ACP 内部的 permission/request 仍由拒绝式路由处理，不能把这条 Core shell 证据扩大成任意 harness 内部工具都可无人审核。

## 验证与后续事项

本轮 Desktop 全量 vitest 859 passed / 14 skipped（在下述并行命令面板改动进入前），之后补了首发权限异步回归与按钮布局，最终相关定向 95/95；Gateway 全量 76/76；AgentFramework 最终全量 580/580；Core Api 定向集 20/20（19 个配置守卫＋真实 full-access 工具链）。Desktop typecheck、生产构建、客户端漂移检查、Ponytail 校验通过。Electron 使用隔离的只读接口夹具检查真实构建页面，1280/820 窗口的页面及操作按钮均无横向溢出，截图位于 `output/model-settings-qa/`；未修改用户配置。

共享工作树的额外读数：全量之后，另一批 Spotlight/命令面板改动进入工作树，`CommandPalette.test.ts` 定向得 3 passed / 7 failed（另外五个参数/权限/投影/翻译测试文件 35/35）。第一条可证明的异常来自旧 HomeController 测试替身没有 `sessions` / `currentProject`；其余断言还涉及新的分组 DOM 与查询延迟，未逐条归因。不能据此前面的全量绿宣称当前整仓全绿。收尾构建发现 `query.trim()` 对 Ref 调用的方法错误，已修为 `query.value.trim()`，最终生产构建通过；这批命令面板功能与旧测试的迁移仍由其批次收口。

为了不占用正在运行的 Core DLL，.NET 验证使用仓库内独立 artifacts 目录。AgentFramework 的基线 TOML 明确复制到测试输出，解除两个测试对旧目录层级的假设。Gateway 的“路由存在”用例也改为模拟上游，避免真实开发 Core 对虚构 agent 返回 404 时误报路由不存在。

尚待单独落实：Anthropic/harness 专属思考参数与真实外部模型验证；提供方/路由的 If-Match 当前先读后判断，`ModelControlDbContext` 没有配置 revision 并发令牌，不能据此宣称同修订号并发写入已经原子化；多条路由和提供方删除仍是多次 HTTP 写入，需要 Core 事务端点才能做到整组原子更新。后两项是源代码检查发现的限制，本轮没有并发变异演练。Core Api 全量、PostgreSQL 和安装版升级未跑。
