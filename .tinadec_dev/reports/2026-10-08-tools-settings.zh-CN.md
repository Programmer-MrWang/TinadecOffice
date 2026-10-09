# 工具设置与 Agent 工具配置实施记录

日期：2026-10-08。基线：main `cf5cbf7` + 当前工作树。规范：[实施契约](../specs/2026-10-08-agent-tool-settings.zh-CN.md)。本记录只验收这次工具配置范围，既有模块整体审计不随之标为完成。

## 实现

设置入口及搜索的中英文名称为“工具 / Tools”。九个标签复用设置主题和通知：总览、Shell、文件、搜索、Git、网页、MCP、Skills、高级配置。项目限定资源可见性；Agent 用持久定义 ID 选择。有效工具取授权与配置的交集，授权编辑跳转 AgentCenter。共享总览的工具使用者从各启用 Agent 的实际有效配置读取，不单凭授权推算；请求并发限制为四，失败及迟到响应不覆盖成功结果。普通页管理资源、绑定和连接状态，参数只经 Monaco 严格 JSON 编辑器保存；支持 Schema 补全、字段说明、有效值来源、差异、错误定位、恢复默认草稿以及保存/放弃/继续编辑退出保护。对象切换使用请求序号防止迟到响应，标签支持键盘及窄窗口滚动。

Core Tools 保存租户/工作区共享默认和稀疏 Agent 覆盖，数组整体替换；Agent 资源字段省略表示继承，显式 null 表示所有当前可用资源、空数组不提供、显式 ID 精确绑定。JSON 拒绝未知/重复键、类型及范围错误；共享安全上限和保护分支始终保留。写入缺少 If-Match 返回 428，旧 revision 返回 412；新资源 POST 要求 If-Match: "0"，创建为服务端新 ID、revision 1。SQLite、PostgreSQL 迁移、OpenAPI 及 Gateway/生成客户端同时接线。

新准入运行冻结参与 Agent 和允许派生模板的配置、MCP 版本、技能包及窄读取根；临时 Agent 继承父定义。恢复和待审批调用继续用冻结配置。execution_context 是 Core 填充的独立协议字段；Tools 每次调用克隆不可变上下文，显式 false/数值不会被默认覆盖。模型目录与真实执行均收窄，结构 manifest 保持不变。

Shell、command_run、文件窗口/目录分页、搜索、各 Git 工具输出和日志、网页、MCP 超时及 Skills 索引预算均接入实际执行。哈希、路径/链接、审批、网页地址保护保持内核约束。禁用文件写入不等同于 Agent 只读，Shell/Git 写能力仍按真实授权展示。

MCP 托管配置存入 Core 资源库，环境值通过 SecretStore 版本引用，普通响应只遮蔽；现有文件非破坏导入并记录摘要，托管运行只消费资源库。连接按资源 ID、revision 和环境指纹复用，新配置开启新连接，旧运行持有原连接直至结束回收。市场安装/更新/卸载共用同一资源库和审批操作；独立 Tools 继续使用文件方式。

Skills 设置和运行索引共用真实发现/校验服务；共享包正文及资源放在 Core 独立内容寻址目录，旧版本保留。项目技能仍来自 skills/**/SKILL.md，修改走受治理文件工具及陈旧哈希保护。继承时项目同名优先，显式 ID 不会被同名替换。绑定只控制提供的索引，普通项目文件读取权限仍由原授权决定。共享包仅追加所选具体包的只读根，两端校验路径和相对资源声明。

## 已取得证据

| 检查 | 结果与证据 |
| --- | --- |
| Desktop 全量组件 | 1068 通过、14 跳过，117 文件通过、1 文件跳过；`.tinadec_dev/evidence/2026-10-08-tools-settings/desktop-vitest.log`（本地日志） |
| Desktop 生产构建 | Worker修复后2m08s、总览接线后1m41s、资源复选框样式后4m01s、最后键盘焦点修复后2m26s，均通过且含vue-tsc；[最终构建日志](../evidence/2026-10-08-tools-settings/desktop-final-keyboard-build.log)。已有chunk循环及体积警告，未新增打包安装验收 |
| Desktop 类型 | vue-tsc 通过，资源诊断接线后追加检查记录于最终证据 |
| Gateway | 86/86 通过，包括条件保存头和上游状态转发 |
| Core Skills | 46/46 通过；[TRX](../evidence/2026-10-08-tools-settings/core-skills/skills.trx) |
| Core 市场与技能 | 最新市场 64 + Skills API 13 = 77/77 通过，包括实际 stdio MCP 安装/调用/卸载、共享包资产/冻结索引/条件导入；[最终 TRX](../evidence/2026-10-08-tools-settings/core-skills-market-final/skills-market-final.trx)。此前 Skills Policy 33/33 未受后续接线改动。旧失败记录保留；独立子进程使用完整 Tools 输出，避免 ASP.NET 测试目录遗漏共享运行库 |
| Core 最新配置/进程/OpenAPI | 配置与空间/编排最新 19 项均有通过证据；另真实进程/Skill/OpenAPI 18/18、根声明 32/32。详细最终复核及 TRX 见下表 |
| Tools 实际执行 | 完整串行 389/389 通过，0 跳过，10m10s；最后网页共享上限加固后 Web/Shell/Git 54/54 通过；[实际结果记录](../evidence/2026-10-08-tools-settings/provider-summary.json)、[最终预算 TRX](../evidence/2026-10-08-tools-settings/provider-web-ceilings.trx)。没有伪称最后小修后又跑了完整套件 |
| 真实 Windows Desktop | 隔离 Core/Gateway/用户目录，三类真实 Agent 九标签、负值校验、明确保存、稀疏覆盖及继承：[阶段一](../evidence/2026-10-08-tools-settings/desktop-phase1.json)；MCP 脱敏/真实连接/空及精确绑定、共享包及资源导入：[阶段二](../evidence/2026-10-08-tools-settings/desktop-phase2.json)；Schema 补全及三种草稿退出选择：[阶段三](../evidence/2026-10-08-tools-settings/desktop-phase3.json)。均无控制台错误 |
| 共享技能实际读取 | 经 Core 用户工具操作及权限门到真实 Tools，正文和 references/example.txt 均完成读取；[证据](../evidence/2026-10-08-tools-settings/shared-skill-real-core.json) |
| 待审批及执行中保存 | 原 command_run 默认 30000ms；待审批保存 100ms，执行中再保存 50ms，原真实 Node 命令 5278ms 后成功完成、未超时，随后恢复默认；[证据](../evidence/2026-10-08-tools-settings/command-freeze-result.json) |
| 根目录治理 | 使用 workspace-root://root 精确声明合法工作区根，窄 src 授权仍拒绝根；治理 3/3 验证真实 grant/lease，path://. 与 ../ 穿越继续拒绝；[TRX](../evidence/2026-10-08-tools-settings/governance-workspace-root.trx) |
| Desktop最终定向 | 总览、实际使用者/竞态/部分失败、中英文和导航4文件17/17通过；[日志](../evidence/2026-10-08-tools-settings/desktop-final-overview-tests.log) |
| Desktop最后键盘/资源检查 | 键盘组件6/6通过；[日志](../evidence/2026-10-08-tools-settings/desktop-final-keyboard-tests.log)。生产ArrowRight进入高级仍聚焦标签；[实际记录](../evidence/2026-10-08-tools-settings/desktop-production-keyboard.json)。720px窗体没有页面横向溢出，标签703px内容在662px容器内滚动、ArrowLeft回Skills后焦点仍在标签，资源勾选框16×16；[窄窗口记录](../evidence/2026-10-08-tools-settings/desktop-production-narrow.json)、[资源截图](../evidence/2026-10-08-tools-settings/desktop-production-resources.png) |
| Desktop生产包 | 真实app://bundle的Schema补全与第2行第28列错误定位、禁用保存、9标签、资源受治理动作均无控制台错误；[最终记录](../evidence/2026-10-08-tools-settings/desktop-production-final.json)、[总览截图](../evidence/2026-10-08-tools-settings/desktop-overview.png)、[补全截图](../evidence/2026-10-08-tools-settings/desktop-production-json-completion.png)。共享总览实际使用者：read_file三类，shell编码/测试，web_fetch资料/测试；[实际结果](../evidence/2026-10-08-tools-settings/desktop-production-shared-users.json) |

全量 Core API 的旧二进制读数为 701/716，失败用例均已逐项修复并在最新定向批次取得通过证据。AgentFramework 最新完整读数为 631/632，唯一 ACP 计时失败隔离重跑通过。没有将这些完整批次描述成一次全部通过。

## 验证边界

### Desktop Tools UI 最终补充

- 生产 `app://bundle` 重新构建后使用 Vite `?worker` 打包 Monaco 的五类 worker。实际 Electron 走查显示九个标签、Test Agent 的 7 项有效工具、来源未声明提示和“使用智能体：Tools QA Test”；总览截图为 `desktop-overview.png`。
- JSON worker 实测返回 `git/mcp/read/search/shell/skills/web/write` Schema 补全；`shell.timeout_ms=-1` 返回最小值错误并禁用保存，行列为第 2 行第 28 列。可见截图：`desktop-production-json-completion.png`、`desktop-production-json-validation.png`。
- 项目技能导入经过真实 Core 返回 `awaiting_user`，界面保留 Core `user_action_id`，项目资源行不提供删除按钮；`desktop-production-skill-action.png`。项目/共享资源切换的迟到请求回归为 5/5 通过。
- 使用者查询只在共享视角按 Agent 的有效配置读取 `allowed_tool_ids`；单 Agent 视角展示当前 Agent。失败不会猜测使用关系，显示不可用状态。总览/使用者/语言定向 17/17 通过；最终生产构建 1m41s 通过。
- 初次生产构建中 plain asset worker 失败的 UI crash 保留为 `desktop-production-worker-initial-error.png`；修复后 `desktop-production-worker-final.log` 中无渲染错误。此失败不是协议降级，最终仍使用 Monaco Schema worker。

本机是 Windows x64；真实 stdio MCP 使用本地 Node 夹具，未连接外部带凭据服务。SQLite 在测试和真实 Desktop 隔离 Core 中实际迁移/持久化；PostgreSQL 迁移代码编译，未运行真实 PostgreSQL。Linux x64、macOS arm64 只沿用已有平台实现路径，本次未取得两平台运行、安装包或原生沙箱证据。浏览器/SSH 作为外部可绑定资源，本次未新增内置工具。

可执行缓存、隔离运行库、数据库及本机日志位于忽略的 `.tinadec_dev/artifacts/`、`.tinadec_dev/tmp/` 或日志目录；可审阅 JSON、TRX、截图和实施资料保存在 evidence/specs/reports。临时宿主只关闭本任务启动的进程，不干预已有开发宿主。

隔离Core 48881、Gateway 48880及本任务Electron宿主均已关闭，未残留隔离端口或宿主；[清理记录](../evidence/2026-10-08-tools-settings/runtime-cleanup.json)。五个受影响模块补充实际数据流图，模块文档索引覆盖55模块、24/24 Core工程、82/82图节点、1917链接且错误为零；[索引记录](../evidence/2026-10-08-tools-settings/documentation-reindex.log)。差异空白检查通过，未创建提交。

## 生产编辑器走查修复

实际 `app://bundle` 走查发现原有 `monaco.config.ts` 将 Worker URL 先存入变量，Vite 将小入口当普通静态资源内联，留下无法解析的相对导入。开发模式通过不能证明该生产路径正确。五类 Worker 已统一改用 `?worker` 导入，打包其依赖；保留 JS/TS、JSON、CSS、HTML 与通用编辑器的原标签路由，没有更改 Desktop 协议权限。修复后的实际生产 JSON 服务返回 Schema 补全，负值定位为第 2 行第 28 列、同步编辑器 markers 并禁止保存，控制台无错误。初次失败截图保留为 `desktop-production-worker-initial-error.png`，不计入通过证据；最终结果与截图在对应 evidence 中。

最后窄窗口走查还修正了两处继承行为：资源勾选框复用既有settings-checkbox以避免文本输入全宽样式；方向键进入高级配置时保留标签焦点，不触发分类编辑器的主动聚焦。分类页的“打开高级配置”仍定位并聚焦对应配置分类。这两处均经最后生产构建与真实窗口确认。

## Core 后端最终复核

最终配置测试覆盖共享约束、Agent 稀疏深合并、受保护分支并集、条件创建/编辑、凭据版本、失效绑定诊断、非破坏一次导入和每次准入只捕获一次资源目录。新资源 POST 同样要求 `If-Match: "0"`，缺少为 428、非零为 412。MCP 与 Skills 的共享及各 Agent/派生模板绑定都从同一次可见目录快照选取，运行中的版本不会随保存改变。

| 最终检查 | 结果 |
| --- | --- |
| Core 配置及回归 19 项 | [首次最新批次](../evidence/2026-10-08-tools-settings/core-backend/core-api-latest-19.trx) 17 通过、2 失败；11 项工具配置、3 项空间工作树、工作树归属/回收、Ask Mode 和 Agent Pack 均通过。剩余为更新后 OpenAPI 基线及旧夹具发送 `permission_mode:null`，均已修正；[定向最终 2 项](../evidence/2026-10-08-tools-settings/core-backend/core-api-final-2.trx) 2/2 通过 |
| 真实 Core → Tools 进程及 Skill/OpenAPI | [18/18 通过](../evidence/2026-10-08-tools-settings/core-backend/core-process-openapi-skill-18.trx)，包括并发不同 Agent 的读取默认值隔离、托管上下文不回退旧 MCP 文件、进程 manifest 不变及上下文释放 |
| AgentFramework 全量 | [631/632 通过](../evidence/2026-10-08-tools-settings/core-backend/agentframework-632.trx)；唯一失败是 1.2 秒 ACP 空闲计时夹具在并行构建负载下超时，[隔离重跑 1/1 通过](../evidence/2026-10-08-tools-settings/core-backend/acp-idle-isolated.trx)，未将该次全量结果描述为全部通过 |
| 根目录及共享包资源声明 | [32/32 通过](../evidence/2026-10-08-tools-settings/core-backend/resource-root-sentinel-32.trx)。合法根目录使用 `workspace-root://root`，避免被一般路径穿越规则拒绝；仍按 `.` 参与前缀授权，窄 `src` 授权不能扩大为工作区根 |

原始全量 API 结果保留为 [701/716](../evidence/2026-10-08-tools-settings/core-backend/core-api-initial.trx)。其失败用例均已在最新定向批次或市场/Skills 批次取得通过证据；未另行重跑全部 API 716 项。汇总与各项名称见 [Core 结果 JSON](../evidence/2026-10-08-tools-settings/core-backend/results.json)。SQLite 已实际验证；本次 PostgreSQL 仅迁移与引用编译，未启动数据库实例。Core 目标构建及最终 API/AgentFramework 测试构建均通过，代码差异空白检查通过。未创建提交。
