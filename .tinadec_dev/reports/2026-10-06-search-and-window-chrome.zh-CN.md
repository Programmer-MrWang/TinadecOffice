# Desktop 搜索浮窗与窗口控制专项

日期：2026-10-06。源码基线：`905d003` + 本轮未提交工作树（该提交仅更新 README；此次 UI 改动基于 `46731fd` 开始）。主责：[APP-RENDERER-103](../../docs/development-program/02-modules/app/shared-renderer/TODO.md#app-renderer-103)；功能：[APP-RENDERER-F002](../../docs/development-program/02-modules/app/shared-renderer/STATUS.md)。

## 交付行为

点击顶栏搜索图标或按 Ctrl+K，默认打开浮动搜索窗口，保留当前页面。浮窗宽度最多760px、高度最多590px，自适应小窗口；只在用户点击放大后铺满应用窗口，关闭后下次仍默认浮窗。使用已有原生 dialog 管理模态焦点与 Escape，未增加搜索页面路由或依赖。

搜索入口与主界面、设置页窗口控制采用透明图标点击区，去掉胶囊填充、边框和阴影，悬停通过图标颜色反馈，保留键盘焦点和原生 no-drag。浮窗内部有类型图标、数量、分类过滤、长文本省略、整组折叠；每组先展示4项，可展开全部已返回结果，再收起。输入新查询立即移除旧结果；异步来源补齐时按结果ID保留键盘选择，避免 Enter 执行上一查询。

## 搜索范围和真实契约

| 类型 | 当前读取与匹配范围 |
| --- | --- |
| 命令、设置 | 现有应用命令与12个设置入口，空查询也可浏览 |
| 项目、会话 | 活跃项目；当前授权工作区/租户的全部活跃会话，按标题、项目名与ID匹配 |
| 模型、智能体、模式 | 当前配置目录；模型包含提供方信息与配置模型ID |
| 提示词 | `/prompt-fragments` 的标题、key、类别、scope与正文，打开实际片段详情 |
| 工具 | Core `/tools/search`，保留服务端结果顺序与实际manifest字段 |
| 资源 | 当前页面所选项目的文件内容，受治理的 `file_search`；最多100条匹配行，按命中文件去重并展示服务端截断提示 |

六个配置目录在一次打开内分别缓存。远端来源独立发布结果，独立5秒截止和HTTP取消；失败显示对应来源提示，可重试，其他结果仍可用。会话失败时可显示已有会话并明确来源失败。关闭、切换查询或重新打开时，旧请求不能回写当前结果。

工具API原客户端期待嵌套的工具发现结果，Core实际返回flat manifest。此次在api.ts边界统一归一化，保留description/input_schema/risk/approval/confirmation_fields等真字段；缺失的来源、domain和评分不制造假值。ToolCenter隐藏不存在的发现字段，查询失败保留已显示数据；风险/来源菜单过滤已返回manifest，不宣称Core已支持这些过滤参数。

提示词的早期实现误读pipeline目录，消费者却选择fragment，已统一到片段契约。文件查询在Code页读取CodeController所选项目，其他页面读取Home项目；结果动作保留查询时的projectId，后续切换项目不会将相对路径打开到错误项目。页面通过既有一次性request channel选择对应项目、会话、文件或配置对象。

设置页已有目录缺少搜索的新目标时复用原加载函数刷新一次，读取去重且最新导航优先，卸载失效；未找到/失败提示不会静默丢掉目标。提供方跳转清除旧列表过滤，按实际API/CLI/TUI/ACP归属选择页签。

## 验证记录

- Desktop全量914 passed/14 skipped，native/scripts107/107；最后的提供方列表定位、工具呈现过滤和输入焦点样式修正后，搜索/Settings定向48/48，`npm run build -w @tinadec/desktop`（含vue-tsc）退出0。构建仍有既有VueUse注释、UIE循环chunk和大chunk提示。
- 测试包含真实页面消费目标、跨项目文件查询归属、flat工具HTTP响应归一化、实际fragment搜索→详情，以及已挂载Settings目录刷新和迟到请求保护。组件HTTP替身验证不等于真实供应商模型调用。
- 真实Electron开发渲染层证据：[checks.json](../evidence/2026-10-06-search-ui/checks.json)、[浮窗截图](../evidence/2026-10-06-search-ui/search-floating.jpg)、[窗口控制截图](../evidence/2026-10-06-search-ui/window-chrome.jpg)。已验证默认浮窗、10类+全部、图标/数量、结果展开/折叠、真实项目查询/过滤、640px无横向溢出、可选全屏/复原、全屏关闭后重开浮窗和Escape关闭，未捕获运行异常。窗口控制与浮窗/输入均无阴影。
- 可复用脚本：[search-ui-qa.mjs](../evidence/2026-10-06-search-ui-qa.mjs)，Windows包装：[search-ui-qa.ps1](../evidence/2026-10-06-search-ui-qa.ps1)。开发窗口最小化时CDP截图会超时；包装仅在截图期间恢复窗口并还原原来的最小化状态。已删除尝试过程的旧全屏/空白截图，只保留最终证据。
- 模块索引reindex通过：55模块、98功能、102任务，Core24/24、总图82/82、1823链接/200稳定ID/0错误；重复运行输出哈希不变。文档验证不替代业务测试。
- 后续交互补充：搜索分类栏隐藏横向滚动指示器但保留滚动；右侧 UIE 主/分栏/普通标签用中键关闭可关闭实例，固定 Home 标签不关闭。`BrowserTabBar.test.ts` 3/3。

## 验收边界

会话检索未搜索历史消息全文；文件检索是当前项目内容，未实现全磁盘文件名索引；提示词pipeline画布不在此片段搜索范围。当前开发Electron专项不代表三平台安装包、真实供应商模型、数据库隔离或整产品功能验收。保留模块整体审计、全局API取消错误分类和窄宽发送布局的独立待核查任务。
