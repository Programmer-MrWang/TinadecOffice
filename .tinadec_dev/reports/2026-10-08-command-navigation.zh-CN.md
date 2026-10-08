# 命令面板入口切换与返回修复

关联：[APP-HOME-104](../../docs/development-program/02-modules/app/home/TODO.md#app-home-104)。本轮先修已明确的交互缺陷；新的斜杠命令族/参数/别名设计见[讨论稿](../research/2026-10-08-slash-command-language.zh-CN.md)。

- 同一模式/权限入口再次点击关闭，不同入口切换子页。比较的是实际显示的子页，避免回到root后父级旧page值让入口失效；aria-expanded同步实际状态。
- 返回按钮显示文字与Backspace/Delete提示。空搜索/非编辑选项焦点返回一级；有文字正常删除，修饰键与IME不触发导航；长按重复事件直到keyup才放行，避免删除恢复的查询/草稿。
- slash子页返回后聚焦发送框，继续编辑斜杠输入，不落入只读镜像搜索框。根页不通过删除键关闭。

验证：ComposerBar、ChatPanel、HomeController、i18nParity共4文件115/115通过；vue-tsc通过，修改文件diff-check通过。原有夹具清理时可能记录AbortError，测试退出成功。

[浏览器记录](../evidence/2026-10-08-command-navigation/checks.json)使用真实Panel SFC和本地目录夹具，Chromium键盘验证非空搜索分别被Backspace/Delete正常删字、空搜索返回root且保持打开；已有图标/风险色/动画/自动关闭的浏览器回归也通过。同目录保留测试/类型/浏览器日志与验证脚本。入口开关与slash草稿焦点由真实ComposerBar组件回归验证，未把Panel夹具当成完整应用验收。

用户已明确混合输入规则：`/team 帮我修改登录页`首次Enter仅设置Team，保留任务正文，之后再发送。该语法仍处于设计讨论，尚未新增统一命令解析器。
