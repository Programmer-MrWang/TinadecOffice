# Desktop / Gateway 存储收口验证

2026-10-09，`f8b233d` 加未提交工作树。此记录解释验证层级，不是另一份产品契约；规范见产品定义 §21。

| 门禁 | 结果 | 证据 |
|---|---|---|
| Desktop 全量 Vue，低并发 | 125 文件通过、1 跳过；1108 例通过、14 跳过 | storage-desktop-vitest-final.log |
| 后续 user 默认绑定设置回归 | 23 文件、199 例通过 | storage-desktop-default-settings.log |
| 后续可信维护、默认来源及 Tools 作用域 | 5 文件、24 例通过 | storage-desktop-host-control.log |
| 最终 Electron 与打包脚本 Node 全量 | 156 例通过、1平台跳过（总157）；含 HTTP/IPC/端点身份/开发环境隔离与最终deb依赖检查 | storage-desktop-node-host-final.log |
| 最终 vue-tsc | 退出 0 | storage-desktop-typecheck.log |
| 最终 Gateway 全量与 OpenAPI | 95 例通过，全局私有宿主 security、两公开探针、HMAC/header转发及不追踪上游redirect契约 | storage-gateway-host-final.log |
| 最终 Core 契约/启动/关闭专项 | 4例通过、0跳过；managed快照、公开challenge、原Testing/scopeless启动、close等待/取消及拒新SSE；不是模块全量 | storage-core-openapi-host.log、storage-core-openapi-host/storage-core-openapi-host.trx |
| 最终 Desktop schema 再生 | 退出 0 | storage-client-host-generation.log |
| 真实 Electron43.3.0 传输边界 | 隔离HTTP/SSE夹具通过；HMAC、主/panel/debug、未验证端点及localhost/IPv6别名拒绝、iframe/未知窗口拒绝、导航与端点撤权、redirect无token | storage-trusted-host-electron.log |
| 生产 Vite 构建 | 曾成功；最后源码冻结后的重复构建由协调者停止，以释放 Linux/PG 验证内存 | storage-desktop-build.log、storage-desktop-build-stopped.log、storage-desktop-artifact-check.json |

构建期间一轮全量的 SearchNavigation 懒加载等待受机器负载影响而超时；单独7/7和随后低并发全量通过。保留失败原日志 `storage-desktop-test.log`，不把它覆盖为全绿结果。

Core snapshot 的旧Testing工厂首先暴露 runtime TOML 来源错误，失败日志保留在 `storage-core-openapi-host-factory-failed.log`；产品源码修复来源选择后，最终4Fact保留旧Testing/DB/DataRoot启动形状，验证Locations已注入但scope documents缺省时仍使用packaged baseline。合法新增storage/config/transfer/challenge契约造成的快照漂移另保留在 `storage-core-openapi-host-drift.log`，快照再生后最终baseline门禁通过。

最后的 settings 来源固定和维护主窗 IPC 变更只扩大对应回归范围，未重复声称整套 Vue 已在这些最终修改后重跑。生产构建保留 TinadecUI barrel 循环分包、PURE 注释和大包提示；没有将已有警告写成没有风险。

保留的 dist 包含 trusted storageAction、关闭取消、user 配置来源和显式 apply 提示。最后两处 Tools 源码保护（manifest await 前捕获固定 scope、项目/Agent 切换重挂 overview）未进入该产物；源码已通过类型与相关组件门禁，不能把保留 dist 当成最终源码一致的发布包。重新发布前须从冻结源码重新构建。

本 Desktop/Gateway 子任务没有完成新功能的真实 Electron 界面走查、真实模型、PostgreSQL 实库、Windows 安装包或 Linux/macOS 执行验证；Core/平台子任务的实库和系统证据由总验收账本单独记录。真实 Electron 夹具只证明受管端点身份与 HTTP/SSE/frame/导航传输边界；路径/并发/代理/组件测试不能替代完整产品验收。旧平台存储和真实用户密钥未读、未迁移、未删除。

最终安全收口把 localhost API 间接访问纳入宿主边界：Core/Gateway 身份需通过公开 HMAC challenge，登记窗口主 frame 由 main 网络层签发，未验证或撤权端点与匿名代理均不获得私有头。删除默认 CDP 监听并剥除 Vite 环境凭据，仍明确可信开发源码可以执行宿主代码，不能将可写开发源码当成产品隔离证明。
