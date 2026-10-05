# 市场路由 insertBefore 排查（2026-10-05）

用户报告：`npm run dev` 开发窗口，首页右侧保持首页，点击市场后出现 `Failed to execute 'insertBefore' on 'Node': parameter 2 is not of type 'Node'.`。本轮基线为 `b6115e6`，使用自己的 Electron、独立 profile 和无安装权限的 API fixture；没有操作用户窗口或真实模型。

## 已确认的代码事实

- `MarketPage` 和 `MarketFilterCard/MarketCatalogCard/MarketDetailCard` 仍为 Vapor，UIE 的 Canvas/Column/Stack/CardHost 已是 classic。市场路由和动态列表、详情都经过混合渲染边界。
- `useUiePage('market')` 在 mounted 中才切换共享布局，而旧 `MarketPage` 立即创建 `UieCanvas`。因此初次画布创建先读取当前布局；从首页进入时会先创建首页卡片，再随市场快照更新替换。该顺序与“首次画布只创建目标页面卡片”不符。
- 旧市场不等待 `UieStore.ready`，保存布局慢读取时还有一次异步恢复；旧 catalog 的 `as unknown as` 包装只是 Vapor 类型补丁。

## 修复

1. 市场路由与三张卡片统一回退 classic，保留 UIE 布局/状态/命令总线和市场业务操作，移除 catalog 的伪数组/字符串类型转换。
2. 市场先等待布局恢复，再选择市场快照并创建画布；此后启动市场读取。离开时标记失活并停轮询，延迟等待结束不再挂载卡片或启动读取。
3. 市场在画布测量与 Vue 更新完成后发 ready；App 的冷启动等待该事件，健康成功不再提前放行市场 splash。
4. Vapor 例外表明确记录四个边界，修正审计测试对 UIE 跨包路径的解析。没有升级 Vue、清空用户缓存或吞掉异常。

## 验证与诚实边界

真实 Electron 修复前：空目录、两条目录数据、条目选择、分类筛选和往返在受控环境中均未复现同一异常；开发冷加载的一次捕获超过装置时间上限，该记录无效，没有当成产品通过。原型探针只记录非 Node 的 insertBefore anchor 和公开堆栈，成功场景均为零。

修复后开发模式：`fixed-dev` 非空目录、选择、筛选和四次市场访问完成；`fixed-cold-delayed` 直接进入市场并人为延迟布局读取 1200ms，随后选择、筛选、返回及再次进入也完成。每次市场都有三张目标卡片，回到首页恢复首页，无错误遮罩/无非法 anchor/无未处理异常。记录与截图在本机 `output/market-route-qa/`，后端 fixture 没有真实安装能力。

行为回归覆盖：首次画布只读取 market、慢布局前不创建内容、不开始控制器、等待期间卸载不重新启动，以及冷市场等待 ready。定向 MarketPage/MarketController/App.entry/Vapor/windowLifecycle **34/34**；UIE **142/142**；完整 Desktop **887 passed / 14 skipped**（threads，退出0）；类型检查及正式 `npm run build -w @tinadec/desktop` 通过。初次 Vapor 审计因跨包文件路径解析失败，修正解析后定向与全量均通过，未放松文件存在断言。

最终构建 `fixed-build` 同样完成非空目录、条目选择、分类筛选和四次市场访问，零错误遮罩/非法 anchor。截图和逐步骤 JSON 保存在同名目录。开发模式是本轮重点，生产构建只作为共用渲染器的补充复验。

这次修复移除了市场混合渲染边界，并修正可证明的挂载顺序缺陷。因为受控基线没有重现用户的同一堆栈，不能把具体底层 anchor 机制写成已证明根因，也不能据此宣称所有用户布局/数据下永不复发。开发窗口的纯 DOM 错误遮罩需要完整重新加载才会清除，HMR 本身不移除已有遮罩。
