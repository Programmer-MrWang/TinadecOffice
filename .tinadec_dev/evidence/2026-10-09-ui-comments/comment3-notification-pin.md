# Comment3：通知列表标题前重复 Pin

日期2026-10-09；TinadecOffice基线`d5e6c8d838f93f6bc26d4b7b77ecb0d9bdb9c2f3`+工作树；任务 [APP-RENDERER-105](../../../docs/development-program/02-modules/app/shared-renderer/TODO.md#app-renderer-105)。

用户明确要求删通知列表标题前的Pin。源码核对发现两个相同入口：NotificationIslandHost的聚合堆叠列表与通知中心active列表，各自在标题前判断persistence绘Pin，右侧另有不可手动关闭状态的Pin。仅删除这两个标题前Pin与唯一无用的`.island-overflow__pin-inline`样式，差分2新增/3删除；没有更改通知状态、持久策略、关闭权限、GraphSeedPack逻辑。

右侧Pin依旧按`!isUserDismissible(item)`显示并保留title提示；胶囊右侧Pin、展开卡片持久chip和NotificationDetailDialog的持久说明均保持各自上下文。前置severity图标仍表达等级；标题现在为纯文本。

## 本地参考（固定 checkout，不宣称上游最新）

| 项目 | SHA | 实际来源与借鉴边界 |
| --- | --- | --- |
| shadcn-vue | `b251d9fd92aa496495e127137a7734704fb34a29` | `apps/v4/styles/reka-vega/ui/sonner/Sonner.vue:41..60`分别提供success/info/warning/error/loading与close图标slot。旧Toast（明确deprecated）`ToastTitle.vue:14..16`标题是slot，`ToastClose.vue:17..19`关闭图标独立定位。参考职责分开；不将deprecated组件当当前推荐。 |
| OpenCodeUI | `371cd9cf156280c325f3759972d096c29e6d71d4` | `src/components/ToastContainer.tsx:82..108`等级图标、标题和关闭动作独立；`src/features/chat/sidebar/NotificationItem.tsx:147..157,183..196`标题、元信息等级图标和尾部动作分开。没有复制其触摸/权限状态逻辑。 |
| openchamber | `74b79d41eac44ff38790c66f238050936083e0bb` | `packages/ui/src/components/ui/sonner.tsx:79..101`封装Sonner并明确closeButton/closeButton class职责。不据普通toast推翻Tinadec source-owned通知仍需要右侧持久状态标识的产品语义。 |

只读参考。shadcn-vue/OpenCodeUI未发现AGENTS；openchamber根AGENTS已读取，本任务没有改该项目。决定依据用户当前明确意图，参考只验证信息和动作不重复表达的局部结构。

## 验证

现有定向命令：`node ../../node_modules/vitest/vitest.mjs run src/components/NotificationIslandHost.test.ts src/components/NotificationDetailDialog.test.ts src/composables/useNotifications.test.ts`。

结果：[comment3-notifications.log](comment3-notifications.log) **46 passed /14 skipped**，2文件通过、1文件跳过。NotificationIslandHost的整个14例describe.skip为既有VueVapor/classic Transition与happy-dom互操作限制；不将其写成通过，也不为低影响删除新增实现镜像测试。真实浏览器列表/完整App、三平台/安装器验收本分工未运行；主任务截图验收另行对账。没有完整Vite构建、提交或推送。

Desktop AGENTS合并建议交给主任务：记录Comment3删除两个列表标题前重复Pin、保留右侧状态标识与关闭权限，46pass/14原有skip，链接本证据，保留真实浏览器验收边界。
