# GraphSeedPack 当前接口回归真实验收

2026-10-10 · Windows · Electron43.3.0 · 独立随机端口/用户根 · 关联APP-HOME-107。

当前真实用户TOML已登记GraphSeedPack3.0.1，因此先复制九份TOML原字节到owned根（不复制数据库或凭据），用真实Core/Gateway验证inventory200与preview up_to_date/ETag="1"。安装场景采用另一个owned根，仅在副本按既有归属关系移除GraphSeed包记录/资源，保留BootstrapFixturePack0.1.0与已发布meeting；该副本先通过真实配置validate再启动Core。真实用户目录不删除测试包、不重置配置、不清空存储。

Electron挂载实际AgentPacksPanel、NotificationDetailDialog、NotificationIslandHost及GraphSeed bootstrap模块，点击安装和确认；第一个PUT前仅在安装副本加入重复草稿，真实400后先检查TOML字节完全未变、无部分安装，再恢复该副本。详情可见configuration_unique、agent_definitions字段组与trace_id。两次普通reconnect保持error；点击明确Retry重新preview/确认后单次PUT201。HTTP记录恰好两个安装请求[400,201]，preview/success ETag保留。

随后renderer reload恢复inventory；真实Core进程被本脚本停止后重新启动，GraphSeed3.0.1和Bootstrap0.1.0可读取、默认配置相同。过期If-Match的DELETE真实返回412/agent_pack_revision_conflict，inventory仍在。当前Core在配置400和该CAS412上未提供ETag，证据记录null；Gateway测试另证实上游若提供失败ETag则透传，不能说本次真实错误有ETag。用户九份TOML before/after哈希一致。

证据包括verification.json、current-config-read.json、installation-fixture.json、desktop-real-http-requests.json、desktop-ui-acceptance.json、desktop-core-restart.json、real-cas-refusal.json、user-config-before/after.json及两张截图。诊断截图已人工查看，内容可读；库存截图展示真实组件标签与包记录。夹具没有完整Settings外层样式，库存图不作为正式页面样式验收。

边界：HTTP宿主token仅由owned Vite代理注入，renderer不持有凭据；服务身份HMAC验证真实HTTP。该专项是实际Core/Gateway+组件窗口验证，生产main/preload宿主链由另一个专项覆盖，不等于完整App/安装器、三平台或PostgreSQL验收。早期几轮因夹具生成空顶层数组、服务/渲染负载超时失败，未计入成功；最终轮采用直接Vue插件和显式现有别名，静态探针后再启动Electron。损坏用户根TOML导致Core启动失败的剩余恢复边界见invalid-root-startup-boundary.json。

复现脚本位于上级目录graphseed-real-{fixture-server.mjs,renderer.mjs,electron.cjs,verify.mjs}，保持本轮实际执行来源。先将它们分别复制为.tinadec_dev/tmp/graphseed-interface-ui/{fixture-server.mjs,renderer.mjs,electron.cjs,verify.mjs}。此专用脚本依赖当前配置含Bootstrap与GraphSeed3.0.1、SQLite、独立Core artifacts、Desktop dist和本地Node/Bun/Electron依赖；未来用户状态不同不得为满足前提改动真实数据。

```powershell
node .tinadec_dev/tmp/graphseed-interface-ui/fixture-server.mjs
node .tinadec_dev/tmp/graphseed-interface-ui/verify.mjs
```

Core DLL取自.tinadec_dev/tmp/workspace-api-audit/bin/TinadecCore.Api/debug/TinadecCore.Api.dll；需先独立编译同路径或改脚本指向新的owned构建。所有子进程均由本脚本创建、退出finally只停止其owned进程树。
