# 第二批七条 UI 标注修复

2026-10-09，Windows；基线 `d5e6c8d838f93f6bc26d4b7b77ecb0d9bdb9c2f3` + 工作树。任务唯一入口：[APP-HOME-106](../../docs/development-program/02-modules/app/home/TODO.md#app-home-106)、[APP-RENDERER-106](../../docs/development-program/02-modules/app/shared-renderer/TODO.md#app-renderer-106)、[APP-SETTINGS-104](../../docs/development-program/02-modules/app/settings/TODO.md#app-settings-104)、[APP-DEBUG-102](../../docs/development-program/02-modules/app/debug-studio/TODO.md#app-debug-102)。保留前批UI、GraphSeedPack与存储修改；本轮未创建提交或修改真实用户配置。

## 标注与结果

| 标注 | 修复与行为 |
| --- | --- |
| 1 | 中英文自由对话文案移除括号后缀，触发器与列表统一。 |
| 2 | 项目菜单8px圆角、4px内边距，选中行5px圆角，背景不会顶到菜单边框。 |
| 3/4 | 模式和权限箭头与aria-expanded同读命令面板的实际page；展开180°、关闭复位、切页正确；160ms过渡且遵守reduced-motion。旧独立Selector同样修正。 |
| 5 | 删除指挥中心的侧栏和命令面板首页入口，NavCard不再绑定该事件。旧/workbench深链转空间模式/space；治理、恢复、记忆等服务与运行事实保留。 |
| 6 | Debug Studio默认隐藏。关于页的显示开关写入本机bootstrap TOML；renderer直接路由、可信主窗口IPC和窗口创建各自复核，禁用后广播刷新并退出/关闭调试页面。 |
| 7 | 项目菜单改为单一原生滚动区，min-height:0配合可用高度；隐藏滚动条，保留滚轮/触控滚动机制及Arrow/Home/End/Tab/Enter/Escape访问。新建按钮常驻，选择后恢复触发器焦点。 |

滚动根因是原UiScrollArea外层只有max-height，内层h-full没有可解析父高度，内容把内层撑高后被外层overflow-hidden裁切；只替换项目菜单该处，不重构公共滚动组件。箭头读取实际内部页，避免返回命令根页或切页后initialPage仍旧导致虚假展开。

视觉验收额外修正UiSwitch关闭滑块与底色相同的问题，使用现有foreground/primary-foreground语义颜色；关于页旧的versionApp缺失翻译键改用已有versionDesktop。

## 配置与范围

原生开关来源为稳定bootstrap，默认 `~/.tinadec/config/desktop.toml`（TINADEC_HOME覆盖时按已有锚点），不是项目配置：

```toml
[developer]
debug_studio_enabled = false
```

设置保存只接受布尔，由可信主窗口主frame执行。Gateway URL由环境管理时仍读取该本机偏好。常见TOML结构局部编辑保留字段/注释，再解析核对语义并原子替换；特殊有效形状沿用serializer，保留字段但可能丢注释。无效TOML/类型拒绝保存。跨窗读请求合并，变更事件排队刷新，迟到读取不能覆盖刚保存状态；保存失败保留旧显示和具体错误。

裸Vite预览单独使用 `tinadec.preview.debug-studio-enabled`，不读写真实desktop.toml；开关同步storage事件，启用后的预览按钮使用同一受守卫调试路由。原生Electron仍创建独立窗口并验证可信主宿主；未放宽Core/Gateway授权。[宿主证据](../evidence/2026-10-09-ui-comments-2/debug-studio-host.md)、[Desktop存储契约](../../apps/desktop/STORAGE.md)。

## 验收

[根任务浏览器记录](../evidence/2026-10-09-ui-comments-2/browser-acceptance.md)区分当前实页、45项离线夹具和宿主模拟：

- Windows1169×719真实主页/关于开关/两个调试路由tab：默认隐藏、键盘切换、持久显示、跨页关闭和旧深链转空间通过；模式/权限实测180°和复位，菜单内边距与圆角通过。
- 45项夹具实际滚轮：列表238高、内容1537，wheel使scrollTop1100且portal不滚；第45项可选、重开自动定位，Home自由对话、End新建均通过。350容器和334工具条clientWidth=scrollWidth，无水平溢出。reduce下三个指示器transitionnone，模拟已恢复。
- 最终定向12文件 **236/236**、0skip；包括Composer/独立权限、导航命令、About/真实router、设置烟测与窗口生命周期。[统一日志](../evidence/2026-10-09-ui-comments-2/final-targeted-tests.log)。最后滑块语义颜色修正后，3文件32项复验也通过。局部74、55、19、100及32来自其子集/重复运行，不能相加。
- 宿主appConfig/main/preload实际源通过Node/VM加载：**23/23**，含本机配置/IPC10项，0skip；覆盖布尔/缺省/managed Gateway/注释、原子替换失败不破坏文件、非可信/辅助窗口拒绝、广播与关闭。[日志](../evidence/2026-10-09-ui-comments-2/debug-studio-host-regression.log)。
- vue-tsc通过。[类型日志](../evidence/2026-10-09-ui-comments-2/typecheck.log)。最终生产Vite构建通过（5m6s），输出到ignored `.tinadec_dev/tmp/ui-comments-2-production`；未覆盖当前服务或用户dist。构建保留已有chunk体积/PURE注释告警；结果见[日志](../evidence/2026-10-09-ui-comments-2/production-build.log)。文档重索引通过：55模块、136功能、127任务、2107链接、263唯一ID，0errors；[文档检查](../evidence/2026-10-09-ui-comments-2/documentation-checks.log)。

当前普通预览页业务403通知仍来自既有可信宿主限制，不把它当本轮UI回归或通过放权消除。UI开关与宿主Node/VM验证不替代真实原生窗口/安装包或Linux/macOS验收；触屏硬件未实测。Debug专用后端与整体改版仍在APP-DEBUG-101，Home/Settings/空间整体审计不因专项完成而勾选。

## 参考与交付

继续使用前批固定提交的shadcn-vue、OpenCodeUI、openchamber、DeepSeek Harness主题对照，来源及闭源产品边界见[前批报告](2026-10-09-ui-comments.zh-CN.md)。本批官方Button/DropdownMenu/Collapsible文档HTTP200记录在[文档证据](../evidence/2026-10-09-ui-comments-2/composer-arrows-shadcn-docs.json)；取舍是明确状态、统一圆角/间距与标准键盘访问，不复制其它产品业务布局。

截图：[实际项目菜单](../evidence/2026-10-09-ui-comments-2/project-menu.jpg)、[权限展开](../evidence/2026-10-09-ui-comments-2/permission-arrow.jpg)、[关于开关](../evidence/2026-10-09-ui-comments-2/about-debug-switch.jpg)、[45项列表](../evidence/2026-10-09-ui-comments-2/projects-long-list.jpg)、[窄布局](../evidence/2026-10-09-ui-comments-2/projects-narrow.jpg)。[离线夹具源码及复现](../evidence/2026-10-09-ui-comments-2/fixture-source/README.md)；最初runtime-only入口改SFC后实际验收，未用编译通过替代页面结果。
