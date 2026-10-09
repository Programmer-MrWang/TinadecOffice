# 根任务集中浏览器验收

2026-10-09 Windows，Codex In-app Browser，原视口1169×719。全部动作使用Computer Use；原用户tab1，临时独立夹具tab3与路由tab4。DOM evaluate仅读取可见页面/样式/边界，滚轮通过CDP Input.dispatchMouseEvent，未注入DOM或Vue状态、没有向真实项目登记表加入测试项目。

1. 真实主页导航只有新聊天/市场，默认没有Debug Studio；自由对话触发器及菜单均无括号。菜单radius8px、padding4px，渲染内边距约4.57px，选中背景不碰边框。
2. 模式页展开时mode aria-expanded=true，arrow matrix(-1,0,0,-1,0,0)；权限false/none。切换权限页后modefalse/none、permissiontrue/180deg；关闭后复位。截图permission-arrow.jpg。
3. 关于switch初始aria-checked=false，Space保存后true，返回主页出现Debug Studio；重回设置仍true。另开调试深链显示实际Debug界面，关闭开关后另tab退首页且入口消失；再直接访问/debug-studio仍落首页。旧/workbench最终路由为/space并显示空间缩放/布局控件。
4. 开关初版off thumb与track均rgb(15,20,26)，不清晰；修UiSwitch语义颜色后off thumb216,227,248 / track15,20,26，on thumb0,49,92 / track162,201,255。保存About最终截图并恢复off。顺手修关于页已有不存在的settings.versionApp翻译键为versionDesktop。
5. 45props隔离夹具：list clientHeight238 / scrollHeight1537；只有list overflow-y:auto，scrollbar-width:none、::-webkit-scrollbar displaynone。真实wheel delta1100后scrollTop1100、portalTop0。End聚焦常驻新建footer，再ArrowUp聚焦第45项；Enter回调fixture-project-44，菜单关闭且焦点回trigger。reopen定位第45项并scrollTop1298.86；Home后Enter选自由对话；End后Enter新建仅触发fixture回调。
6. 窄350容器clientWidth=scrollWidth350；composer/toolbar334=334，未溢出。窄菜单viewport x226.57–674.68、y462.21–710.99，纵向列表高度207，footer仍可达，无水平滚动。截图projects-narrow.jpg、projects-long-list.jpg。
7. 临时prefers-reduced-motion:reduce下项目/模式/权限三箭头transition:none，展开180deg/关闭复位依旧正确；随后清除模拟。

预览shim原openDebugStudio为空操作，补成启用才跳转受守卫路由后，重新加载预览；关于开启→返回主页→实际点击Debug Studio，确认进入调试页并显示时间线/图/指标/诊断导航。关闭仍恢复default off。原生preload创建窗口职责不变。

当前Vite浏览器预览没有Electron可信主宿主签发，业务请求的403通知属于现有授权边界；本轮没有放宽它。调试开关preview UI状态与真实desktop.toml分离。TOML/IPC信任与关闭窗口行为以23项Node/VM专项为证据，未冒称真实原生窗口/安装包验收。Linux/macOS/真实触屏硬件未验收。
