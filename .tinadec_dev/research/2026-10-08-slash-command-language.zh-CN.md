# 斜杠命令语言、参数补全与菜单返回：讨论稿

日期：2026-10-08。关联：[APP-HOME-104](../../docs/development-program/02-modules/app/home/TODO.md#app-home-104)。本轮实际修复重复点击入口和返回键；下文新的命令语法与注册表是下一步设计建议，不当作已实现功能。

用户已明确：`/team 帮我修改登录页` 按Enter只切换Team，保留“帮我修改登录页”，再次发送才启动任务。项目采用新契约，不为旧版本设计命令兼容分支。

## 1. 定位

斜杠是输入框的命令入口，承担发现操作、补全参数和快速执行。鼠标面板、键盘输入与后续GUI共用同一个操作定义和执行函数，状态仍由原控制器/Core拥有。

“每个功能都有命令”可以落实为命令族和参数：`/mode`是命令，`team`是参数，`/team`是该具体选择的快捷别名。权限同理：`/permission full-access`与点击“完全访问”调用同一设置动作。单纯给现有菜单多加搜索词，不能满足直接执行。

建议区分三类执行：

| 类型 | 示例 | 执行方式 |
| --- | --- | --- |
| 即时动作 | `/image`、`/file`、`/stop` | 打开文件选择器、停止任务等既有操作；没有参数不等于需要模型理解 |
| 设置命令 | `/mode team`、`/permission full-access`、`/model <提供商/模型>`、`/plan on` | 验证参数，调用既有会话设置操作，影响下一次提交 |
| 任务/提示词命令 | `/queue <任务>`、`/parallel <任务>`、未来Skill指令 | 按定义提交任务或展开提示词；不能与设置命令混成一种行为 |

## 2. 当前源码缺口

1. `apps/desktop/src/lib/appCommands.ts:slashCommands/parseSlashCommand`仅登记new/stop/queue/parallel，按空白拆token并丢掉原始位置。
2. `lib/composerCommands.ts:composerSettings`是菜单配置表；模型/权限等没有正式名称、参数定义或执行结果。
3. `composerSlashQuery`只读取第一个词。`/permission full-access`的值不会进入参数补全。
4. `ComposerCommandPanel:allRows`在root只列菜单入口；动态预设/权限/模型值只在子页加载。因而`/team`找不到直接选择项；模式入口关键词也不能代表实际已发布Team版本。
5. slash root搜索框只读，真正输入在textarea；进入子页后焦点却移动到子页搜索框。若返回再聚焦只读框，用户无法继续编辑命令。
6. 设置由事件emit触发，命令文本在保存结果前就消费；新的文本命令需要成功/失败结果与原始片段范围，避免失败后丢失命令或迟到结果覆盖后来编辑的正文。

需要统一“解析→候选→参数→执行”，不是继续给组件堆积按名称判断的分支。

## 3. 建议语法

| 命令 | 建议行为/范围 |
| --- | --- |
| `/team` 或 `/mode team` | 平面切到当前目录的已发布Team预设；alias最终解析为ModeVersionId |
| `/permission full-access` | 当前会话完全访问；参数候选同时展示风险图标和说明 |
| `/permission default` | 当前会话恢复默认审批方式 |
| `/model <提供商/模型>` | 选择真实配置目录中的对话模型；重名时列候选，不猜提供商 |
| `/model default` | 明确清除模型覆盖，调用既有clear语义 |
| `/plan on`、`/plan off` | 空间计划优先的明确设置，重复执行不会反复翻转状态 |
| `/spec on/off`、`/agents on/off`、`/board on/off`、`/worktree on/off` | 空间各自独立选项；保持运行依赖校验 |
| `/workflow <流程>`、`/workflow off` | 选择真实已发布图或关闭；不是任意boolean模拟完整工作流 |
| `/image`、`/file` | 打开选择器，选中后附加文件；取消不制造上传或消息 |

显示名可用中文；命令保留稳定英文名称，并提供明确别名，例如`/权限 完全访问`。`默认`这样的多义词应出现在对应命令参数中，不能作为一个会悄悄决定模式/模型/权限的全局快捷词。

每行要显示可执行语法：例如“Team　/mode team（/team）”“完全访问　/permission full-access”，并保留当前值、可用性和作用范围。用户可以学习名称，以后直接输入。

平面与空间保持已确定的产品边界：平面选预设，空间组合能力。`/team`不能在空间偷偷套用完整Team预设；可说明它属于平面，并提示空间的`/agents on`。Plan同样按上下文显示实际含义，避免把空间计划优先变成只读Plan预设。

## 4. 输入与确认

- `/`：展示当前上下文全部命令，输入焦点留在发送框；slash来源的弹层不再放第二个只读搜索框。
- `/te`：按名称/别名/中文标签筛选，显示Team的直接操作候选；Enter确认高亮的具体选择，Tab补全名称。
- `/permission `：进入权限参数候选；继续输入`full`筛选，Tab补齐，Enter执行。无参数的`/permission`也可以打开参数选择，鼠标只是辅助。
- `+`：打开独立搜索，不改草稿；候选来自同一注册表，选项点击和文字执行共用处理器。
- 未知名称/非法参数：说明错误，保留输入；显式选择“作为普通文字发送”后才进入消息流程。
- 模型目录未加载、命令不可用于当前界面、名称匹配不唯一：显示加载/不可用/歧义候选，不能静默回落。
- 单条设置只作用当前会话或新会话草稿；工作区默认要有显式不同作用域。停止任务等即时命令按各自既有行为处理。

用户确认的例子：

```text
输入：/team 帮我修改登录页
第一次 Enter：解析并选择Team → 确认设置成功 → 草稿剩下“帮我修改登录页”
第二次 Enter：用已选设置发送这条任务
```

`/permission full-access 帮我检查项目`同理：消费命令名和一个有效参数，保留后面的原始正文。设置命令不因为有尾随正文就自动启动模型。

执行失败时保留整段原始命令。成功只替换被解析的命令片段，不用split/join重建全文，不改变换行/引号/正文空格。等待保存期间用户改了草稿或切会话，迟到结果不能覆盖新内容或写错上下文。

## 5. 返回行为与本轮修复

已修复：同一模式/权限入口第二次点击关闭；不同入口切换到对应子页；返回根页后原入口还能重新进入。入口aria-expanded按实际子页反映状态。

返回按钮有文字与按键提示，Esc也可返回/关闭。Backspace/Delete建议且已实现以下规则：

- 子页搜索为空，或者焦点在非编辑选项上：返回一层。
- 搜索里有文字、文本有选择、消息框正常编辑：按键用于删除文字。
- Ctrl/Meta/Alt/Shift组合及IME不触发返回。
- 长按一次返回后，重复事件被消费直到keyup，避免误删恢复的搜索或消息。
- 根页没有上一级，不自动关闭、不吞草稿；slash来源返回后恢复发送框焦点，允许继续编辑命令。

当前UI只有root和一层子页，所以现有back即可。未来若做提供商→模型等更深结构，用导航栈保存每层查询/选中项/滚动位置；不把返回硬编码成跳到root。

## 6. 工作区项目与官方资料核对

| 项目 | 本轮实际源码证据 | 对Tinadec的启示 |
| --- | --- | --- |
| OpenCode | `../../../opencode/packages/app/src/context/command.tsx:75`统一CommandOption；`components/prompt-input.tsx:694,718`区分builtin直接动作和custom提示词；`pages/session/use-composer-commands.tsx:49`注册模型/Agent；`:1300`只在空编辑器特定光标条件下处理Backspace模式返回 | 统一动作数据与处理器，返回键不能吞正常编辑。不能宣称其所有动作均支持同样参数语法 |
| dsh-TUI | `../../../dsh-TUI/src/commands.ts:201`逐token解析路径与别名，children(path)提供下一层；`src/dsh-adapter/channel/command-completions.ts`准备模型/参数候选 | 命令族与多级参数补全，不在输入控件逐功能写分支。它是第三方Harness前端 |
| Pi | `../../../pi/packages/tui/src/autocomplete.ts:257,339,384`SlashCommand含getArgumentCompletions；名字与空格后的参数分别补全，applyCompletion维护光标 | 把参数候选作为命令自身能力，正文/命令范围与光标要清楚 |
| Hermes | `../../../hermes-agent/hermes_cli/commands.py:43`含aliases/args_hint/subcommands/busy_policy；`apps/desktop/src/lib/desktop-slash-commands.ts:90`分action/picker/rpc/exec及options/text/mixed | 同一命令定义声明参数与执行类型，忙时/作用域明确；typed参数不能落成普通提示词 |
| OpenCodeUI | `../../../OpenCodeUI/src/features/chat/InputBox.tsx:819`前端动作直接dispatch，自定义命令生成带textRange的attachment；SlashCommandMenu提供selectCurrent | 分清动作与提示词，保留文本范围和焦点 |
| OpenChamber | `../../../openchamber/packages/ui/src/components/chat/CommandAutocomplete.tsx:240`合并命令/Skill/扩展并前缀排序；[官方Commands & Snippets](https://docs.openchamber.dev/commands-snippets/) | 命令发现可跨来源，不能把可复用提示词误当运行设置 |

[OpenCode官方命令文档](https://opencode.ai/docs/commands/)将自定义命令定义为带参数的提示词模板；[dsh-TUI用户指南](https://github.com/ccch1mneyyy/dsh-TUI/blob/main/docs/user-guide.md)说明其命令使用。我们借鉴名称/参数/补全/执行分流，具体设置仍由Tinadec已有Controller→Gateway→Core处理。

## 7. 建议下一步结构

统一命令定义至少包含id、canonical name、aliases、label/icon/risk、可用上下文、参数类型/候选、当前值、执行函数和结果。先把现有两张表收敛，菜单与slash读取同一命令/参数集合，不新增第二套状态或通用后端命令执行API。

实现顺序建议：模式/权限/模型的直接参数与快捷别名 → 空间明确on/off与工作流参数 → 附件动作和既有new/stop/queue/parallel同注册 → 未来Skill/提示词类别。每步验证输入、GUI选择、错误保留、上下文捕获与第二次发送，按真实功能接线验收。

## 验证边界

本轮收起/返回修复已通过4文件115项定向和vue-tsc；实际组件浏览器记录在[导航证据](../evidence/2026-10-08-command-navigation/checks.json)。新语法表仍是讨论建议，当前代码尚未让`/team`等所有设置别名直接执行。
