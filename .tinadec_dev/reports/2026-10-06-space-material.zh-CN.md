# 空间模式全局材质修复

关联 APP-RENDERER-104。SpatialPage没有经过平面聊天的UieStack，缺少全局材质属性与派生滤镜变量，surface token回落到默认实心。现复用usePanelStyles，以透明空间根传递属性和变量；发送框沿用既有样式，卡片与快捷入口消费派生滤镜。移除节点背景叠加与预览祖先filter，阴影直接放到表面。

验证：usePanelStyles + ComposerBar定向43/43。真实Electron依次切换opaque/translucent/blur，确认发送框、两张真实工作卡、导航控件响应；空间根始终透明且无整层滤镜。blur=20时发送框4px、工作卡7px，遵循既有全局派生规则。已查看截图；测试结束恢复用户材质设置及路由。页面既有network error提示未隐藏，本轮未请求模型或验证后端业务。

[实测数据](../evidence/2026-10-06-space-material-ui/checks.json) · [模糊截图](../evidence/2026-10-06-space-material-ui/blur.jpg) · [CDP脚本](../evidence/2026-10-06-space-material-ui-qa.mjs)

## 底部画布修正

删除操作提示及对应双语文案，移除space-flow-area的196px底部预留；发送框改为覆盖完整画布，透明dock空白不截获指针。真实Electron验证画布与内容区底边一致，距底30px命中画布，中键移动55/-45px后视角相应变化、发送框位置保持不变。测试恢复原视角和路由。仅模板/CSS与无用文案删除，未重复业务单测。

[实测结果](../evidence/2026-10-06-space-full-canvas-ui/checks.json) · [脚本](../evidence/2026-10-06-space-full-canvas-ui-qa.mjs)
