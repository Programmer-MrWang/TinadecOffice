# 隔离 Desktop 界面验收夹具

2026-10-09 · Windows · Electron43.3.0。保留本轮最后实际使用的四份脚本，不将它们作为产品启动器。它们只使用随机owned根/端口，用户配置只读复制；不会启动真实用户存储、复制数据库或凭据、停止用户应用。宿主token在夹具服务端随机产生并校验Core/Gateway HMAC，不进入renderer。

`ui-fixture-server.mjs` 是服务编排与真实HTTP代理；`ui-renderer.mjs`挂载本仓实际AgentPacksPanel/通知组件；`ui-electron.cjs`点击真实控件、读取详情、等待绘制与抓图；`ui-verify.mjs`核对HTTP请求和真实用户九份配置hash。脚本中root相对层级与原临时目录相同，内部模块名按下面落点固定。

本轮前提：用户配置包含BootstrapFixturePack，尚未安装GraphSeed3.0.1；九份TOML可以完整读取，Storage使用SQLite；本仓已有Desktop dist基础CSS、Node/Bun/Electron依赖和独立Core构建。夹具首次PUT在副本注入重复草稿，真实400后仅恢复副本。用户状态不同不得直接把此专用夹具当通用工具；它不重置真实根来满足前提。

复验先按总报告编译独立 `--artifacts-path .tinadec_dev/tmp/graphseed-api-artifacts`，然后将本目录脚本复制到 `.tinadec_dev/tmp/graphseed-ui/`，分别命名为 `fixture-server.mjs`、`renderer.mjs`、`electron.cjs`、`verify.mjs`。从仓库根执行：

```powershell
node .tinadec_dev/tmp/graphseed-ui/fixture-server.mjs
node .tinadec_dev/tmp/graphseed-ui/verify.mjs
```

输出保存到本证据目录；原before快照属于本轮，新的复验必须另建只读before快照，避免把用户合法后续修改误判为污染。失败的服务日志仅保存在ignored owned runtime目录；退出只停止由当前脚本自己启动的进程树。真实Core进程重启回执和renderer重载分别记录。基础CSS来自已有build，不宣称完整App/安装器或本轮生产样式验收。
