# 隔离项目选择器夹具源码

这七份源文件从 `.tinadec_dev/tmp/ui-comments-2/` 复制归档。复现时复制回该目录，在仓库根执行 `npx vite build --config .tinadec_dev/tmp/ui-comments-2/vite.config.mjs`。已有 Desktop Vite 在5173运行时，可打开其 `/@fs/C:/git/agent/TinadecOffice/.tinadec_dev/tmp/ui-comments-2/dist/index.html`；不同机器替换仓库绝对路径。

根组件是预编译的 FixtureRoot.vue，导入真实 ComposerBar、ComposerCommandPanel、共享CSS与两语言资源。45项目只作为props；HomeController/API/材质持久化精准alias为离线fixture，fetch明确拒绝联网，选择仅改变自己的Vue ref与output。该目录不包含生产构建产物、凭据或真实用户数据。

最初独立入口误用了runtime template，runtime-only Vue挂载空节点；改为SFC后通过实际浏览器确认渲染、滚轮与末项选择。此事只涉及夹具，不是产品启动问题。源码中的可见error面板用于防止只以编译成功代替实际验收。
