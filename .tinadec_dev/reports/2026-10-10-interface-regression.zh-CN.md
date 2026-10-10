# 工作区、历史数据与 AgentPack 接口回归修复

日期：2026-10-10。基线：`a8374926d2746d10e20b5caf28bf373095fb910b`。唯一任务：[APP-HOME-107](../../docs/development-program/02-modules/app/home/TODO.md#app-home-107)。

本轮恢复可信桌面的业务准入、独立存储读取及生命周期挂载，公开局部故障的完整诊断。现有用户配置、数据库、测试包和工作区登记均保留；不迁移、不清空 `.tinadec`。开发浏览器承担界面预览，不能借用桌面凭据操作用户数据。

## 修复与责任边界

| 阶段 | 具体行为 | 主要源码 |
| --- | --- | --- |
| 宿主与启动 | 独立 checking/ready/unavailable/rejected 状态；首次失败启动有限退避；周期失败立即撤权；单次在途、退出和迟到守卫；身份拒绝保持阻断、可手动重试；状态/重试 IPC 独立校验可信主 frame | `electron/hostConnection.cjs`、`main.cjs`、`preload.cjs`、`scripts/backendReadiness.mjs` |
| 业务准入 | 开发启动等待 Core、Gateway 健康及 HMAC 身份；Desktop 读写与每次 SSE 连接检查宿主，发送前固定 scope；开发等待超时打开受认证阻断的恢复界面；撤权暂停读取/流，恢复仅刷新读取；浏览器显示预览限制 | `hostAccess.ts`、`useConnection.ts`、`HostAvailabilityBanner.vue`、`runStream.ts`、`scopedEventSource.ts` |
| Core 存储 | Mount 按稳定项目 ID 查询全部生命周期，保留归档/回收站；逐登记验证配置和授权；目录、配置、数据库原因分类，未知生命周期为 null；取消传播；坏登记通过可信宿主注销，不挂载、不删磁盘数据 | `StorageScopeRegistry.cs`、`StorageEndpoints.cs`、`StorageScopeRowError.cs` |
| 公开错误 | 已有 code 也补分类，业务提供的分类、trace、diagnostics 保留；仅拦截已有 trace 的 ProblemDetails writer；Gateway 公开白名单过滤私有扩展、上游错误 ETag 若存在则透传；五种 transport 保持 AbortError | `ErrorClassification.cs`、`TracePreservingProblemDetailsWriter.cs`、`errorMapper.ts`、`coreClient.ts`、OpenAPI/schema |
| 作用域历史 | 显式 storageId → 调用绑定 → 项目/会话/运行实体 → 未绑定列表默认 user → 当前选择；历史/归档/回收站/search逐项结算，以 storage_id+id 去重；失败保旧数据与该项诊断，取消与迟到不能覆盖选择 | `storageScope.ts`、`sessionRoster.ts`、`ArchiveTrashSection.vue`、`spotlight.ts`、`HomeController.ts` |
| 工作区与设置 | 首页项目/诊断/运行就绪分别更新；坏项保登记与恢复入口；编辑器保草稿、诊断与 CAS；存储配置及维护回执有代次和 scope 守卫，断线清理预览；禁止向坏/未知/非 active 项迁移 | `WorkspaceEditorDialog.vue`、`StorageSection.vue`、`AppSidebar.vue` |
| AgentPack | 认证完成后检查库存；失败读取保旧库存；恢复只读、不重放安装；明确重试重新 preview/确认，单次 PUT；版本、摘要和用户默认采用规则不变 | `AgentPacksPanel.vue`、现有 `graphSeedPackBootstrap.ts` 与安装客户端 |

真实工作区短链还定位到缺默认Agent Mode的普通409绕过ProblemDetails，导致既有设置动作和trace未输出。本轮将创建/会话节点缺失/清除默认模式三处同码拒绝统一到现有ProblemDetails路径，保留409、code和原message，保持准入与默认选择规则；隔离API补强单例1/1通过（exit0）；创建和清除模式均输出设置动作与trace，不产生部分写入。见[Core补强记录](../evidence/2026-10-10-interface-regression/core-agent-mode-errors.md)。

活跃流在撤权后保留 handle、lastSeq、已见事件和聚合正文；恢复读到真实运行清单后重连。运行清单读取失败不能当作空清单清除游标。内容回收、缓存清理和存储删除都按用户确认的 scope/preview_id 执行，迟到响应不能展示在新 scope 或清除新操作状态。

## 验证记录

| 层 | 实际结果 | 证据与解释 |
| --- | --- | --- |
| Core API | 17 个去重场景各有通过证据，分批运行 | [core-api-validation.md](../evidence/2026-10-10-interface-regression/core-api-validation.md)。初次13例12通过/1 trace失败，修复后HTTP8/8、损坏目录单例及缺默认模式单例均通过；不伪称一次17全绿 |
| Gateway | 全量103通过/0失败，16文件 | [最终摘要](../evidence/2026-10-10-interface-regression/verification-tests.json)。tsc仍20个既有测试mock TS2352（Bun fetch.preconnect），产品src无诊断；类型检查不算全绿 |
| Desktop 定向 | 最终9文件97/97通过 | [desktop-final-targeted.log](../evidence/2026-10-10-interface-regression/verification-tests.json)。包括断线游标、运行清单暂时失败、预览迟到及维护完成迟到 |
| Desktop 最终全量 | 134文件通过、1文件跳过；1215通过、14跳过；178.37s | [desktop-final-full.log](../evidence/2026-10-10-interface-regression/verification-tests.json)，`npx vitest run --maxWorkers=2`，最终产品源码树 |
| Electron/启动脚本 Node链 | 最终180通过、1跳过，0失败；11.86s | [desktop-final-node.log](../evidence/2026-10-10-interface-regression/verification-tests.json)，从package.json标准Node链单独执行 |
| Desktop 类型/生产构建 | 最终 `npm run build` 退出0；vue-tsc通过，Vite生产构建7m06s | [desktop-final-build.log](../evidence/2026-10-10-interface-regression/verification-tests.json)。最后代码树，非旧构建；Native锁校验通过 |
| Windows 宿主 | 生产 main/preload、真实 WebFrameMain/HMAC/IPC 夹具 passed=true | [README](../evidence/2026-10-10-host-readiness/README.zh-CN.md)。身份 HTTP transport、生命周期及原生目录返回值由夹具替代，不能当完整 App 网络验收 |
| GraphSeedPack | 真实 Core → Gateway → Electron 组件窗口失败400、手动重试201，恰好2个 PUT；重连无 PUT；reload及Core重启可读 | [VALIDATION](../evidence/2026-10-10-interface-regression/graphseed-real/VALIDATION.md)、[verification.json](../evidence/2026-10-10-interface-regression/graphseed-real/verification.json)。失败字节不变/无部分安装，默认选择保留，九份用户TOML哈希前后一致 |
| Windows 工作区组件/真实HTTP | 真实main/preload与窗口完成多目录选择、preview200、一次open200，仅主目录存储初始化；真实HTTP在owned scope安装GraphSeed后session201、history200及Core/Gateway重启恢复通过 | [工作区专项](../evidence/2026-10-10-interface-regression/workspace-real/README.zh-CN.md)、[history-http-acceptance.json](../evidence/2026-10-10-interface-regression/workspace-real/history-http-acceptance.json)。空配置根最初session409为agent_mode_not_configured；初轮UI脚本未执行App bootstrap前置；随后在同一owned根补验编辑名称/primary及明确已有打开，生产控制器创建/重命名和renderer reload均通过，见[补验记录](../evidence/2026-10-10-interface-regression/workspace-real/followup-desktop-acceptance.json) |

Gateway转发失败ETag的定向测试通过；本次真实配置400和CAS412上游未提供ETag，证据为null。成功与preview有ETag，不补造缺失值。

最初Desktop全量发现旧测试缺API roster mock、旧Core单健康源码断言等回归断言，已同步新契约。第二轮1199通过/1 SearchNavigation wait超时/14 skip；该文件单独7/7通过，保留原失败日志。最后类型检查发现新增测试签名以及listRuns强类型映射问题，修复后再执行最终检查，不用旧结果覆盖最终状态。

## 真实服务、夹具与未验收边界

GraphSeed专项在隔离配置副本与随机端口执行。当前用户配置原字节副本inventory及preview也通过；安装副本保留已发布 meeting 与 BootstrapFixturePack，仅调整该副本构造失败/安装前提。脚本finally只停止自身创建的进程。截图来自实际安装/诊断组件，但没有完整Settings外层，不作为正式页面样式验收。

工作区夹具前两轮冷模块加载超时，最终轮完成真实创建。其后session409由短链取回完整body，确认正确project scope缺已发布默认Agent Mode；仅在owned scope明确安装GraphSeed后，创建与历史及服务重启均通过。同一owned根满足前置后，补验真实UI编辑名称/主要目录（PUT200）、明确打开已有（open200，身份/存储相同、不覆盖）、生产HomeController创建/重命名（POST201/PATCH200）及renderer reload显示两条真实历史均通过。会话创建/重命名由生产控制器调用，不伪称为每个侧栏菜单的人工点击。测试期间两次Home热更新也发生过，不将HMR推断当409原因。

5173浏览器预览提示与能力限制由App/连接/编辑器组件测试覆盖。CUA两次attach timeout，未取得浏览器实际点击证据，不能把组件检查写成实页成功。Windows完整App/安装器、Linux/macOS沙箱与PostgreSQL本轮未执行；此前多文件夹专项证据不折算为本轮新验收。用户根TOML损坏仍可能使Core启动Reconcile退出，本轮项目列表行级容错不表示用户根损坏启动已修复。

验证摘要与原始输出摘要哈希保存在 verification-tests.json；原始控制台日志继续保留本机忽略路径，不纳入Git。证据目录经只读扫描：不包含宿主凭据字面值、真实用户TOML全文或数据库。配置验证仅记录名称、字节长度和SHA-256；夹具凭据运行时随机生成。

## 使用与提交

改动涉及Electron main/preload和统一启动器，Vite热更新不能应用这部分修复。使用更新代码重新启动开发桌面与受管服务后才能验证新的宿主准入/恢复链。用户数据保留。5173继续用于界面预览，真实工作区与资源操作在可信桌面执行。

本轮代码提交（main，仅本机、不push）：

| 提交 | 模块/阶段 |
| --- | --- |
| `a3e27c7d` | 宿主认证、启动恢复与业务准入 |
| `8273c59f` | Core生命周期挂载、坏登记隔离和分类/trace |
| `b5617177` | Gateway公开错误、工作区可用性与OpenAPI/schema |
| `0f0f1afa` | Desktop作用域历史、流游标及读取/草稿/维护恢复 |
| `607b7406` | Core缺默认模式的会话拒绝补齐分类、恢复动作及trace |

本报告、模块档案、reindex汇总与验收证据另归文档提交。用户原有 `.gitignore` 修改不纳入本轮提交。

最终文档检查：reindex覆盖55模块、24 Core工程、82架构节点，2235链接，errors=[]；git diff --check通过。启动器最后5/5定向与Node全链180/1skip均通过，超时只打开恢复界面，不放行业务。
