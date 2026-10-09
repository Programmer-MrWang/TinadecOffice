# Home 项目选择器与展开指示：主任务实页验收对账

2026-10-09。以下浏览器结果来自主任务集中取证；本子任务据此将唯一 Home 模块 APP-HOME-F006 更新为已验收，APP-HOME-106 保持实现/已完成。产品文档只记录功能结果与边界，临时夹具修复过程留在本证据。

## 实际页面和隔离夹具结果

- Windows1169×719真实主页面：自由对话标签、8px圆角、4px内距（渲染测量约4.57px）正确；模式与权限箭头实际旋转180°，切到另一个页或返回根页复位，与 aria-expanded一致。
- 45项真实ComposerBar SFC夹具：列表clientHeight238、scrollHeight1537；原生鼠标滚轮delta1100后scrollTop1100，portal自身scrollTop0，页脚固定。End到新建入口，ArrowUp到第45项，Enter选择`fixture-project-44`；重新打开聚焦第45项并scrollTop约1298.86。Home到自由对话，End到新建入口并触发`openNewProject`。选择和新建仅更新隔离夹具回调。
- 350px窄容器及工具栏clientWidth等于scrollWidth（350/334）；菜单x226..675、y462..711在视口内。滚动条隐藏规则为`scrollbar-width:none`及WebKit伪元素隐藏，实际列表可滚动。
- reduced-motion下模式/权限/项目三个chevron的transition为none，展开方向正确；检查后恢复普通模式。

截图由主任务保存：`project-menu.jpg`、`permission-arrow.jpg`。统一12文件236项测试通过、0skip，类型检查通过；本模块组件专项74项与统一回归包含重叠，不累加。生产构建最后switch颜色差分的结果由统一报告记录，此证据不提前宣告。

## 临时预览修复

初始预览Root使用运行时字符串template，在runtime-only Vue构建中未被编译并出现白屏。主任务改为`.tinadec_dev/tmp/ui-comments-2/FixtureRoot.vue`，由Vite Vue插件预编译SFC；`fixture.ts`导入该Root并通过`createApp(Root)`挂载。临时入口同时记录window.error、unhandledrejection与app.errorHandler到明确的fixture-error，避免空白预览掩盖错误。

此修复仅涉及隔离预览，不改变ComposerBar生产模板或开启产品运行时模板编译。`window.fetch`明确拒绝网络；45项为伪项目，不读取用户凭据、不接产品store、不登记实际项目。

## 验收边界

本次只覆盖普通Windows浏览器UI、鼠标滚轮、键盘与真实SFC隔离预览，不覆盖触屏硬件、Linux/macOS、完整Home、真实项目登记或欢迎页附件上传/发送。最终统一报告为`.tinadec_dev/reports/2026-10-09-ui-comments-2.zh-CN.md`。
