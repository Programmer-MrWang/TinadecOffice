import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Reproducible, offline, vector-native architecture deliverable. No runtime dependency.
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const W = 4240, H = 3070;
const colors = {
  app: { ink: '#245cb0', soft: '#edf4ff', line: '#b6cbed' },
  gateway: { ink: '#087f8c', soft: '#eaf7f8', line: '#add8dc' },
  core: { ink: '#7353ae', soft: '#f4f0fb', line: '#d0c0e8' },
  tools: { ink: '#b8671d', soft: '#fff5e9', line: '#e9c69d' },
  data: { ink: '#22754e', soft: '#eef8f1', line: '#b9dac5' },
  neutral: { ink: '#526177', soft: '#f2f5f8', line: '#cbd4df' },
  partial: { ink: '#9b6417', soft: '#fffaed', line: '#d8b663' },
};
const nodes = [], panels = [], edges = [];
function panel(id, x, y, w, h, title, subtitle, theme) {
  panels.push({ id, x, y, w, h, title, subtitle, theme });
}
function node(id, x, y, w, h, title, lines, theme, source, detail, relations = [], module = null, partial = false) {
  nodes.push({ id, x, y, w, h, title, lines, theme, source, detail, relations, module, partial });
}
function edge(from, to, points, label = '', theme = 'neutral', dashed = false, both = false) {
  edges.push({ from, to, points, label, theme, dashed, both });
}
const P = 'TinadecCore/';

// Four product boundaries. These are the current integrated deployment, not a universal dependency chain.
node('appProduct', 56, 175, 830, 104, '① TinadecApp · 用户工作台', ['Electron Desktop / Web / 共享 TinadecUI'], 'app', 'apps/desktop/package.json', '用户的操作入口与本地体验。当前渲染层统一连接 Gateway；桌面原生功能经 preload IPC。', ['gatewayProduct', 'desktop', 'web']);
node('gatewayProduct', 922, 175, 516, 104, '② TinadecGateway · 接口门面', ['Bun + Elysia · :48730'], 'gateway', 'TinadecGateway/src/index.ts', 'HTTP、SSE 与契约投影的无状态入口。Core 的业务状态、审批与工具策略由 Core 决定。', ['coreProduct', 'gwTransport']);
node('coreProduct', 1474, 175, 1930, 104, '③ TinadecCore · 运行与治理权威', ['.NET 10 / Microsoft Agent Framework 1.18 · :48731 · 一进程内的模块化单体'], 'core', P + 'Runtime/TinadecCoreServiceCollectionExtensions.cs:32', '会话、任务、模型配置、权限、审批、事件与恢复的权威。24 个产品工程；图中的内部框通常是模块或类群，不是各自部署的服务。', ['toolsProduct', 'api', 'runtime', 'dmaea']);
node('toolsProduct', 3440, 175, 744, 104, '④ TinadecTool · 具体执行', ['TinadecTools · .NET 10 · Core 管理子进程'], 'tools', 'TinadecTools/Program.cs', '工具产品接收可信宿主请求，执行文件、Git、命令、MCP 和网络操作；本机主链是 JSON Lines stdio。', ['toolProtocol', 'toolResources']);
edge('appProduct', 'gatewayProduct', [[886,227],[922,227]], '', 'app', false, true);
edge('gatewayProduct', 'coreProduct', [[1438,227],[1474,227]], '', 'gateway', false, true);
edge('coreProduct', 'toolsProduct', [[3404,227],[3440,227]], '', 'tools', false, true);

panel('appPanel', 56, 326, 830, 1690, 'App / 客户端模块', '共享业务界面；桌面额外提供原生桥与本地服务管理', 'app');
node('desktop',92,422,366,130,'apps/desktop',['Electron 43 + Vue 3.6','桌面窗口、分离面板、桌宠'], 'app','apps/desktop/package.json','Electron main + preload + Vue renderer。桌面独立窗口和桌宠属于本地交互能力。',['renderer','nativeBridge']);
node('web',484,422,366,130,'apps/web',['复用 desktop/src 渲染层','Vite :5174 · webShim'], 'app','apps/web/vite.config.ts:10','Web 使用与 Desktop 相同的业务组件与路由，由 webShim 适配平台契约。目前没有本地PTY、桌宠、分离窗口、原生目录选择，也没有Electron磁盘布局adapter。',['renderer']);
node('renderer',92,580,758,130,'共享渲染层 / App.vue + Router + API',['Vue / TypeScript / Pinia / i18n / Monaco / xterm','生成的 OpenAPI 类型 + HTTP 请求 + SSE 活动订阅'], 'app','apps/desktop/src/main.ts','组合页面、状态、路由、通知与 API 客户端，展示 Core 返回的状态。',['home','code','govUi','settings','marketUi','debugUi','uiEngine','gwTransport']);
node('home',92,738,366,130,'Home / 对话与执行过程',['会话、附件、排队/并行/插入','活动时间线、工具、审批'], 'app','apps/desktop/src/controllers/HomeController.ts:22','发送用户意图，展示按 run 归属的模型流、执行活动与可裁决审批；HomeController 负责前端交互协调。',['interactions','dmaea','governance']);
node('code',484,738,366,130,'Code / 编程工作台',['Monaco、文件树、搜索','Git、diff、预览、终端'], 'app','apps/desktop/src/pages/CodePage.vue','文件/Git 读操作调用 Gateway 的 code/tools 面并由 Core 执行；受治理写操作调用 user/tool-actions。用户本地终端经 IPC，智能体终端经 Core。',['gwUserTools','nativeBridge','terminals']);
node('govUi',92,896,366,130,'运行与治理 / 数据页面',['Workbench、治理板、Memory','Library、快照、恢复检查'], 'app','apps/desktop/src/router.ts','包括正式Workbench运行工作台，展示能力权限、记忆候选、制品与工作区快照/恢复检查。页面存在不表示完整恢复计划 UX 已完成。',['governance','memory','lifecycle']);
node('settings',484,896,366,130,'Settings / 配置中心',['模型、智能体、模式、AgentPack','提示词、集成、工作区/偏好'], 'app','apps/desktop/src/pages/SettingsPage.vue','编辑 Core 中的草稿与发布版本，管理模型提供方及参数、包与集成。桌面偏好另存本地。',['agentConfig','models','skills','prefs']);
node('marketUi',92,1054,366,130,'Market / 市场',['目录、筛选、详情','受控安装与安装状态'], 'app','apps/desktop/src/pages/MarketPage.vue','市场页面使用 UIE 卡片，目录与安装业务由 Core 的 Skills 市场服务承载。',['skills','uiCards','gwConfig']);
node('debugUi',484,1054,366,130,'Debug Studio / 诊断',['调试界面、时间线/图/指标','trace / metrics 后端仍为桩'], 'partial','apps/desktop/src/pages/DebugStudioPage.vue','已有调试界面，Core运行journal/SSE和回放机制另有实现；但debug traces/spans/metrics/diagnostics仍为空集合，trace detail 404，模拟/breakpoint写501，不能视作完整调试后端。',['lifecycle','gwControl'],null,true);
node('uiEngine',92,1212,366,130,'TinadecUI / engine',['纯 TS · 布局树 / 命令总线','reducer、undo、修复/序列化'], 'app','apps/TinadecUI/src/index.ts:4','UIE 是唯一工作台布局系统。engine 不依赖 DOM，处理列/栈/卡片模型、命令总线、布局计算与持久化协议。',['uiCards','prefs']);
node('uiCards',484,1212,366,130,'TinadecUI / components',['UieCanvas / Column / Stack','CardHost、卡片、响应式 store'], 'app','apps/TinadecUI/src/index.ts:6','Vue组件单向依赖engine。15卡型：nav/chat/homePicker/git/approval/orchestration/organization/events/doctor/browser/agent/terminal/marketFilter/marketCatalog/marketDetail。classic/Vapor是渲染实现细节。',['uiEngine','renderer']);
node('nativeBridge',92,1370,758,130,'Electron main ↔ preload ↔ window.tinadec',['IPC：窗口/文件对话框/剪贴板/布局/本地终端/服务发现','用户终端 → terminalManager → node-pty / ConPTY → 本机 Shell'], 'app','apps/desktop/electron/preload.cjs','renderer 通过受控 preload API 使用原生能力。用户打开的本地终端属于桌面功能，与 Core 管理的智能体工具终端是两条路径。',['serviceManager','prefs','nativeAssets']);
node('serviceManager',92,1528,366,130,'本地服务发现与管理',['内置 runtime / 服务健康探测','启动/停止 Core、Gateway'], 'app','apps/desktop/electron/serviceManager.cjs','当前实现使用resources/runtime随包路径；只在packaged且Gateway满足规范本地URL时拥有服务，localhost/127.0.0.1:48730及尾斜杠可规范化。未读Manager注册；开发由脚本启动，Tools子进程归Core。',['coreProduct','gatewayProduct','release']);
node('prefs',484,1528,366,130,'Desktop 本地持久化',['uie-layout.json · 按项目布局','窗口、主题、桌宠与应用偏好'], 'app','apps/desktop/electron/layoutStore.cjs','桌面保存本地交互偏好，不承担会话/审批/模型路由的第二份业务权威；Web当前没有磁盘布局adapter。',['uiEngine']);
node('packs',92,1686,366,130,'AgentPack 产品内容',['GraphSeedPack · 七种模式','统一 meeting · 默认 Team'], 'app','apps/desktop/src/agentPacks/GraphSeedPack/manifest.json','App 携带包制品，Core 负责 preview/install、归属、启禁与不可变发布版本。Solo/Plan/Team/Review/Spec/Graph/Workflow 是包定义。',['agentConfig','release']);
node('nativeAssets',484,1686,366,130,'native / 平台辅助资源',['pin 版 ripgrep、PTY/ConPTY','Windows PortableGit 随包'], 'app','apps/desktop/scripts/runtimeTargets.mjs:8','三平台附带原生搜索及 PTY 相关资源；Windows 另携带 PortableGit，POSIX 使用系统 Git。native/codex-src 当前不是产品运行依赖。',['release','toolFiles','toolGit']);
node('appRead',92,1844,758,130,'客户端与 Core 的责任交界',['App 表达意图、展示事实；Core 裁决执行和授权','独立产品可替换；图上箭头表示当前 Office 集成路径'], 'app','docs/tinadec-core-product-definition.zh-CN.md:97','四产品可独立版本化和组合。当前桌面/Web 渲染层经 Gateway 使用 Core，不意味着所有产品必须捆绑安装。',['gatewayProduct','coreProduct']);

panel('gwPanel',922,326,516,1690,'Gateway / 转发与契约','只维护传输与投影，不拥有业务状态','gateway');
node('gwTransport',952,422,456,180,'HTTP 门面 / auth / coreClient',['/api/v1 · CORS · tenant headers','云模式：API Key / JWT HS256','snake_case / ProblemDetails','request id / OpenAPI / Swagger'], 'gateway','TinadecGateway/src/auth.ts','云端认证支持API Key/JWT HS256与tenant headers，本地模式跳过认证。coreClient构造上游请求、转发错误，映射器投影前端契约；新增Core字段需同步投影与快照。',['aspnet','tenancy','contracts']);
node('gwSessions',952,616,456,154,'项目 / 会话 / run',['projects / sessions / interactions','runs / stream / events / attachments','取消、暂停、恢复、上下文补丁'], 'gateway','TinadecGateway/src/index.ts','会话与运行控制 API 代理 Core。interaction 受理返回 JSON；客户端另订阅 run SSE。',['interactions','lifecycle','context']);
node('gwConfig',952,810,456,154,'配置 / 市场 / 模型',['agents / modes / packs / prompts','model-settings / providers / routes','market / extensions / MCP / ACP'], 'gateway','TinadecGateway/src/index.ts','前端配置与市场路由族，包括harness与model-routes；不存在/api/v1/skills字面路由。发布/安装/模型绑定业务规则由Core完成。',['agentConfig','models','skills','prompts']);
node('gwControl',952,1004,456,154,'治理 / 组织 / 诊断',['approvals / permission / snapshots','organization / TinaChat / topology','debug / memory / evolution'], 'gateway','TinadecGateway/src/organizationRoutes.ts','组织与 TinaChat 契约分别有同步生成的接口/路由表；审批、拓扑与调试仍是 Core 权威。',['governance','tinaChat','agentGraph','lifecycle']);
node('gwUserTools',952,1198,456,154,'工具传输 / Core-owned',['code/tools 读执行 → Core','user/tool-actions 受治理写 → Core','agent tools → run-scoped Core'], 'gateway','TinadecGateway/src/index.ts:1200','当前 code/tools execute 代理 Core 的 tools execute。用户写动作走 Core UserToolActionService；智能体写走冻结 run 的 dispatcher。',['directTools','userActions','coreTools']);
node('gwStream',952,1392,456,154,'streaming / 长连接',['SSE 与日志/附件响应体转发','入站 AbortSignal 传到上游','客户端断开 → 中止上游读取'], 'gateway','TinadecGateway/src/streaming.ts','支持流式响应透传与取消，不在网关复制运行状态。模型预览/最终回答、工具活动在 Core 产生。',['gwSessions','lifecycle']);
node('optionalRuntime',952,1586,456,154,'可选独立 Tool Runtime',['health / manifest / tools 读代理','默认 URL 空；执行仍转 Core','不是本机主执行链'], 'partial','TinadecGateway/src/config.ts:74','仅显式配置时这三个只读接口转独立服务。未配置时health/tools回Core，manifest返回501。执行接口始终经Core；本机Tools由Core stdio子进程承载。',['coreTools','gwUserTools'],null,true);
node('wsPartial',952,1780,456,174,'WebSocket / 当前边界',['terminal / debug / collaboration','已有路由与本地 pub/sub','尚未连接上游 WS'], 'partial','TinadecGateway/src/index.ts:2326','index.ts 构造上游地址后未建立连接；已有 websocket.ts 代理辅助代码不能作为已接通双向上游的证据。Desktop 用户终端使用 IPC。',['nativeBridge'],null,true);

panel('corePanel',1474,326,1930,1860,'Core / 24 个工程组成的模块化单体','框内是职责与运行协作；编译依赖统一经端口与组合根','core');
node('api',1510,422,594,140,'Api · 可执行宿主',['Program.cs · 配置 / 健康 / 启动','ASP.NET Core · 本地 :48731'], 'core',P+'Api/Program.cs','启动可执行 API 宿主，引用 AspNetCore 挂载层。',['aspnet'], 'Api');
node('aspnet',2136,422,594,140,'AspNetCore · 可嵌入 HTTP 层',['AddTinadecCoreHttp / MapTinadecCore','端点、DTO、SSE、OpenAPI、控制面'], 'core',P+'AspNetCore/TinadecCore.AspNetCore.csproj','提供可以挂载到其它 ASP.NET Core 应用的 HTTP 层，引用 Runtime。端点实现现已在此模块。',['runtime','interactions','directTools','userActions'], 'AspNetCore');
node('runtime',2762,422,606,140,'Runtime · 唯一组合根',['DI 装配 15 个 registrar / 恢复协调','模型解析、委托审批、组织唤醒、拓扑'], 'core',P+'Runtime/TinadecCoreServiceCollectionExtensions.cs:32','负责全模块装配和跨模块适配：身份边界、正式模式、模型策略、用户工具动作、恢复、就绪探针。可选择性装配模块。',['dmaea','governance','agentConfig','tinaChat','agentGraph'], 'Runtime');
node('tenancy',1510,602,438,140,'Tenancy · 身份与隔离',['tenant / workspace / principal','项目与调用上下文边界'], 'core',P+'Tenancy/TenancyModuleRegistrar.cs','统一调用主体、租户和工作区范围，使持久化查询与授权具备可信上下文。',['governance','persistence'], 'Tenancy');
node('agentConfig',1982,602,438,140,'AgentConfiguration',['agent / mode / pack 生命周期','草稿→发布版本→run 冻结'], 'core',P+'AgentConfiguration/AgentConfigurationModuleRegistrar.cs','管理智能体与模式的版本、包归属与启禁、安装预览和清理；正式版本以不可变快照参与运行。',['runtime','dmaea','models'], 'AgentConfiguration');
node('models',2454,602,438,140,'Models · 模型与 Harness',['API SDK / 路由 / 参数 / 密钥引用','ACP / Headless / TUI / ConPTY'], 'core',P+'Models/Harness/AgentChatClientFactory.cs:18','提供模型实例、路由与能力；协议适配和外部 agent harness 都归 Models。DmaEA 通过 IAgentChatClientFactory 使用它，不持有具体协议传输实现。',['dmaea','modelExternal','secretStore'], 'Models');
node('agentGraph',2926,602,442,140,'AgentGraph · 图与资源',['资源租约 / 环境 / 执行目标','审批规则、证据归档与 recall'], 'core',P+'AgentGraph/AgentGraphModuleRegistrar.cs','管理图协作资源、写范围冲突、环境登记与执行目标解析、审批规则及证据检索。登记能力不等同于完整远程资源隔离。',['dmaea','coreTools','tinaChat','vector'], 'AgentGraph');

panel('dmaeaPanel',1510,782,1180,622,'DmaEA · 双层调用运行时 / MAF 适配','operation：协调与监督；execution：持工具的执行者','core');
node('interactions',1540,878,550,126,'1 受理 / 冻结 / 入队',['Coordinator · 201 interaction receipt','模式、名册、模型、manifest、工作区'], 'core',P+'DmaEA/FullDuplexRunCoordinator.cs:241','受理用户消息，创建运行/turn，冻结配置与工作区事实，交给持久引擎。运行过程中不临时重新读可变配置。',['engine','agentConfig','models','coreTools','context'], 'DmaEA');
node('engine',2112,878,548,126,'2 持久运行引擎',['checkpoint / lease / replay / recovery','queued / parallel / insert · run control'], 'core',P+'DmaEA/FullDuplexRunEngine.cs:664','推动运行阶段，保存 checkpoint、管理运行租约、处理中断与安全边界上下文补丁。任务级工具并发切片已存在，独立执行子 run 尚未闭环。',['planner','executor','supervisor','finalizer','lifecycle']);
node('planner',1540,1048,350,126,'3 operation / 计划',['名册选人、任务 DAG','声明边与派发权限'], 'core',P+'DmaEA/PlanningAgent.cs','按冻结名册和模式职责生成任务图与明确assignee。operation角色可按配置拥有工具面，工具调用仍受manifest、grant及授权约束；不是引擎永久禁止治理层持工具。',['executor','agentGraph']);
node('executor',1928,1048,350,126,'4 execution / 执行',['任务、spawn / lineage','Models→工具回合→证据'], 'core',P+'DmaEA/FullDuplexRunEngine.cs','执行者按冻结工具与委派包络运行，通过Models调用模型，再使用Core Tools派发工具；可将任务派给许可目标，受深度、预算、资源及权限约束。task_dispatch仍向当前run添加任务。',['models','coreTools','agentGraph','tinaChat','loopGuard']);
node('supervisor',2316,1048,344,126,'5 operation / 监督',['检查任务结果与证据','pass / replan / escalate'], 'core',P+'DmaEA/FullDuplexRunEngine.cs','监督阶段根据事实裁决，重规划继续或升级为 awaiting_user，由用户裁决后恢复。失败任务与未决任务分别记账。',['planner','finalizer','governance']);
node('finalizer',1540,1220,550,126,'6 meeting / 最终对话输出',['回答预览 → 正式回答落地','model.output.* / answer.* → SSE'], 'core',P+'DmaEA/ModelOutputStream.cs','对话身份以执行结果和监督事实形成最终答复。提供方未完成时可先发公开推理/回答预览；正式回答在裁决后落地并替换预览。',['memory','lifecycle','gwStream']);
node('evolution',2112,1220,548,126,'旁路 / 运营与候选演化',['上下文整理、记忆/智能体候选','审查、审计；完整评估/canary 未闭环'], 'partial',P+'DmaEA/DmaEAModuleRegistrar.cs','运行生命周期在多个anchor触发上下文整理/能力顾问等运营角色，完成阶段可生成记忆/智能体候选。完整演化评估、晋升与canary生命周期未闭环。',['memory','agentConfig','context'],null,true);
edge('interactions','engine',[[2090,941],[2112,941]],'','core');
edge('planner','executor',[[1890,1111],[1928,1111]],'','core');
edge('executor','supervisor',[[2278,1111],[2316,1111]],'','core');
edge('engine','planner',[[2386,1004],[2386,1026],[1715,1026],[1715,1048]],'','core');
edge('supervisor','finalizer',[[2488,1174],[2488,1196],[1815,1196],[1815,1220]],'','core');

node('governance',2730,782,638,140,'Governance · 授权与审批',['PDP / grants / capability lease / action approval','人工审批、委托审查、证据与审计'], 'core',P+'Governance/GovernanceModuleRegistrar.cs','Core 唯一授权裁决点。权限包络与一次性动作审批分别验证；委托审查受工具、风险与会话授权上限约束。full-access 是用户授权路径。',['coreTools','userActions','tenancy','agentGraph'], 'Governance');
node('tinaChat',2730,942,638,140,'TinaChat · 会话组织通信',['成员、房间、公告板、私聊、计划与报告','durable wake / 提醒 / 意图采纳与执行交接'], 'core',P+'TinaChat/TinaChatModuleRegistrar.cs','每个会话可形成组织，成员通过它沟通。持久唤醒与运行补丁连接执行者/常驻治理角色；全局聊天室 UI 已移除，Core 只读观察 API 保留。',['executor','runtime','agentGraph'], 'TinaChat');
node('lifecycle',2730,1102,638,140,'Lifecycle · 运行事实与恢复',['run / tool execution / approval / event','checkpoint / stream / 审计 / 工作区快照'], 'core',P+'Lifecycle/LifecycleModuleRegistrar.cs','保存运行事实、事件与控制记录，支撑SSE回放和恢复判断；turn表属于Memory。父子run存储/级联控制基础已有，完整执行子run与恢复计划UX仍未闭环。',['engine','persistence','contentStore','gwStream'], 'Lifecycle');
node('coreTools',2730,1262,638,142,'Tools · 工具治理与适配',['冻结 manifest、scope、dispatcher、terminal registry','IToolProvider → 本地进程 / 可替换远端 provider'], 'core',P+'Tools/ToolsModuleRegistrar.cs:19','这是 Core 中的工具治理模块，和右侧实际执行产品 TinadecTools 不同。准备/授权/审批/租约/恢复后才向工具提供方发送可信请求。',['governance','agentGraph','toolsProduct','terminals','directTools','userActions'], 'Tools');

node('context',1510,1450,594,132,'Context · 本轮输入与补丁',['上下文 pack / 项目指令 / SKILL.md','预算裁剪、共享与 run-scoped patch'], 'core',P+'Context/ContextModuleRegistrar.cs','准备本轮模型输入，读取项目指令与实际工作区 skill 文件，分配上下文预算并应用安全边界补丁。完整事件驱动压缩尚未闭环。',['prompts','memory','strategies'], 'Context');
node('prompts',2136,1450,594,132,'Prompts · 提示词组装与版本',['系统职责、工作区、任务/证据段','版本化片段 + 冻结流水线 + 纯策略'], 'core',P+'Prompts/PromptsModuleRegistrar.cs','组装系统职责、版本化提示词片段、工作区及任务证据；流水线发布属于AgentConfiguration，本模块消费冻结流水线和版本片段。',['context','strategies','agentConfig'], 'Prompts');
node('memory',2762,1450,606,132,'Memory · 会话与长期记忆',['session / message / turn / context / memory','候选审查、关键词排序与正文引用'], 'core',P+'Memory/MemoryModuleRegistrar.cs:43','保存会话消息与长期记忆，和Context本轮输入组装不同。已审核记忆当前按关键词评分检索，没有接通向量检索；证据archive的混合检索在AgentGraph。',['contentStore','strategies','agentGraph'], 'Memory');
node('skills',1510,1618,594,132,'Skills · 市场与集成配置',['市场目录 / 安装 / MCP-ACP 配置','通用 ISkillProvider 仍为 skeleton'], 'partial',P+'Skills/SkillsModuleRegistrar.cs:43','市场目录与受控安装、集成配置已实现；通用 ListSkillsAsync/GetSkillAsync 仍为空实现。实际工作区 SKILL.md 的读取在 Context。',['context','marketUi','coreTools'], 'Skills',true);
node('loopGuard',2136,1618,594,132,'LoopGuard · 防空转与预算',['重复调用 / 连错 / 迭代与调用上限','任务 token 预算；配合引擎收尾'], 'core',P+'LoopGuard/LoopGuardModuleRegistrar.cs','ILoopGuard判断任务轮数/token/调用数/连错与重复指纹；空响应和run总token预算在引擎。预算耗尽可收走工具并要求总结，目标未完成须保留事实。',['executor','strategies'], 'LoopGuard');
node('vector',2762,1618,606,132,'VectorStore · 检索底座',['embedding / 项目向量索引 / 相似检索','SQLite sqlite-vec / PostgreSQL pgvector'], 'core',P+'VectorStore/VectorStoreModuleRegistrar.cs','已被AgentGraph证据archive用于向量+关键词混合检索；无embedding可降级关键词。Memory当前仅关键词检索，不能声称长期记忆已接向量。',['agentGraph','database','models'], 'VectorStore');
node('abstractions',1510,1790,594,132,'Abstractions · 跨模块端口',['接口、Core 领域类型、模块注册协议','业务模块通过接口协作'], 'neutral',P+'Abstractions/TinadecCore.Abstractions.csproj','跨模块端口是编译边界。模块间运行时调用存在，但不通过互相引用具体实现完成。Abstractions 引用 Contracts。',['contracts','runtime'], 'Abstractions');
node('contracts',2136,1790,594,132,'Contracts · 对外契约类型',['Core-owned DTO / transport contracts','OpenAPI → Gateway 快照 → 前端类型'], 'neutral',P+'Contracts/TinadecCore.Contracts.csproj','承载对外契约与类型，不将 MAF 私有类型泄露到持久化或公共 API。网关映射与生成客户端需要同时维护。',['gwTransport','renderer'], 'Contracts');
node('strategies',2762,1790,606,132,'Strategies · F# 纯策略',['上下文预算、prompt 选择、记忆评分','loop 检测、状态转移函数'], 'neutral',P+'Strategies/TinadecCore.Strategies.fsproj','用纯函数表达可单测策略。存在的状态转移函数不能被当作全部 run 引擎状态的唯一执行权威。',['context','memory','prompts','loopGuard'], 'Strategies');
node('persistence',1510,1962,594,152,'Persistence · 公共存储适配',['EF Core 配置 / StoragePaths / ContentStore','SecretStore / nonce / 原子文件写入'], 'data',P+'Persistence/ServiceCollectionExtensions.cs','公共数据库配置、内容路径/原子写、密钥引用与 nonce 存储；领域各自拥有 DbContext，当前共有 11 个。',['database','contentStore','secretStore'], 'Persistence');
node('sqliteMigration',2136,1962,594,152,'Storage.Migrations.Sqlite',['SQLite EF migrations / schema 对账','默认关系库；本地 SQLite 向量库'], 'data',P+'Storage.Migrations.Sqlite/TinadecCore.Storage.Migrations.Sqlite.csproj','与 PostgreSQL 迁移工程分开，避免把提供方差异隐藏在领域逻辑中。默认部署使用 SQLite。',['database'], 'Storage.Migrations.Sqlite');
node('pgMigration',2762,1962,606,152,'Storage.Migrations.PostgreSql',['PostgreSQL EF migrations','可选部署 / pgvector'], 'data',P+'Storage.Migrations.PostgreSql/TinadecCore.Storage.Migrations.PostgreSql.csproj','提供 PostgreSQL 持久化迁移与可选数据库部署。存在 CI 不代表本轮重新验证了真实 PostgreSQL。',['database'], 'Storage.Migrations.PostgreSql');

panel('toolPanel',3440,326,744,1860,'Tools / 执行产品与构建期生成器','具体执行约束属于工具；最终授权裁决属于 Core','tools');
node('toolProtocol',3476,422,672,164,'stdio 宿主 / manifest v2 / registry',['UTF-8 JSON Lines · stdin / stdout · call id','tool_id / session_id / approved / params','工具描述、风险、审批、副作用、重试元数据'], 'tools','TinadecTools/Abstractions/ToolCalling.cs:11','Core 按 workspace/execution root 管理 Tools 子进程。先取 #manifest 并冻结目录/hash；请求与结果按调用 id 关联，终端事件也走该管道。',['coreTools','toolFiles','toolGit','toolCommand','toolMcp','toolWeb']);
node('toolFiles',3476,626,672,152,'FileRW / Search · 文件与搜索',['read / write / 行与字节编辑 / ls / stat','路径根、符号链接、文件 hash / ripgrep'], 'tools','TinadecTools/Tools/FileRW/FileSystemTools.cs','统一工作区路径解析与允许根，读写与搜索面分明；文件写还受审批与确认字段约束。',['toolResources','nativeAssets']);
node('toolGit',3476,818,672,152,'Git · 仓库操作',['status / diff / log / blame / ref / history','index / commit / branch / worktree / merge','fetch / pull / push / discard / 分支保护'], 'tools','TinadecTools/Tools/Git/GitCli.cs','用安全参数列表调用 Git，读取与写入各有描述、风险与确认约束。远程副作用不能被普通工作区回滚保证覆盖。',['toolResources','governance']);
node('toolCommand',3476,1010,672,152,'Command / Terminal · 命令与进程',['command_run / shell / long_lived','终端 session / stdin / kill / status / replay','超时、取消、输出流与进程状态'], 'tools','TinadecTools/Tools/Command/ShellTool.cs:134','一次性与长驻 shell 进入平台沙箱运行时；输出流与终端事件返回 Core，由 Core 投影运行状态。',['sandbox','terminals','toolResources']);
node('sandbox',3476,1202,672,180,'Runtime / Sandbox · 平台执行边界',['Windows：低权限账户 / ACL / DPAPI / JobObject','Linux：Landlock · macOS：Seatbelt / sandbox-exec','POSIX 限制写入；读/执行/网络非全面隔离','实现与测试代码存在；本轮未做账户/内核实测'], 'tools','TinadecTools/Runtime/Sandbox/CommandSandboxRuntime.cs:19','自动选择平台后端，处理环境清洗、超时、取消与流式命令。Windows 初次低权限账户设置可能需 UAC。不能把不同平台的实现画成同等完整隔离。',['toolCommand','toolResources']);
node('toolMcp',3476,1422,672,152,'MCP · 外部工具扩展',['server 配置 / stdio 连接池','list / search / invoke · invoke 审批闸','由 Tools 启动/连接外部 MCP server'], 'tools','TinadecTools/Tools/Mcp/McpClientPool.cs:63','当前实现是 stdio MCP client。浏览器等工具可由配置的外部 MCP server 提供；此处不假设自带浏览器自动化或 A2A 运行模块。',['mcpExternal','skills']);
node('toolWeb',3476,1614,672,152,'Web · 受约束网络抓取',['HTTP(S) / 重定向 / DNS 地址复验','体积、内容提取、deadline / 公网地址限制'], 'tools','TinadecTools/Tools/Web/WebFetchGuard.cs','提供受约束的网页抓取工具。它与浏览器渲染/自动化不是同一个能力。',['networkExternal']);
node('generators',3476,1806,672,152,'TinadecTools.Generators · 构建期',['Roslyn 增量 source generator','[ToolFunction] → 注册与参数 JSON Schema','TTG001：缺工具描述告警'], 'neutral','TinadecTools.Generators/ToolFunctionGenerator.cs:9','生成静态工具注册和参数 schema，由 Tools 工程作为 Analyzer 引用。不是运行中的网络服务或单独进程。',['toolProtocol']);
node('toolBoundary',3476,1998,672,136,'双层执行约束',['Core 授权 → 可信宿主 approved → Tools 校验','Tools 不读取 Core DB，也不独立裁决 Core 权限'], 'tools','TinadecTools/Abstractions/ToolRegistry.cs:117','工具的 approved 字段来自可信宿主；工具在此基础上检查路径、确认、分支及沙箱约束。两层职责不可混淆。',['governance','coreTools','sandbox']);
edge('coreTools','toolProtocol',[[3368,1333],[3422,1333],[3422,504],[3476,504]],'','tools');

panel('dataPanel',56,2240,1250,348,'数据与持久化 / Core 所有','关系库保存业务事实；正文、证据与密钥采用独立存储','data');
node('database',92,2336,378,206,'关系状态与向量',['SQLite 默认 / PostgreSQL 可选','11 个领域 DbContext','会话、run、版本、审批、组织','sqlite-vec / pgvector'], 'data',P+'Persistence/TinadecDatabaseConfigurer.cs','DbContext：Tenancy、AgentConfiguration、Lifecycle、Governance、Models、Prompts、Memory、Integration、AgentControl、AgentGraph、TinaChat。各自分区，不代表 11 台数据库。',['persistence','vector','sqliteMigration','pgMigration']);
node('contentStore',492,2336,378,206,'内容、事件与证据文件',['sessions / tasks / events / artifacts','content / vectors / harness scratch','SHA-256 引用、原子写','正文/快照/日志与运行引用'], 'data',P+'Persistence/StoragePaths.cs:24','Core-owned data root管理sessions/tasks/events/artifacts/content/vectors/harness-workspaces。正文经内容引用连接关系记录，证据与快照各有生命周期。',['memory','lifecycle','agentGraph']);
node('secretStore',892,2336,378,206,'密钥与一次性材料',['provider credential 仅存引用','Windows DPAPI / 加密 SecretStore','approval nonce：吊销 / 一次消耗','与普通事件、提示词分离'], 'data',P+'Persistence/SecretStoreFactory.cs','密钥不作为普通业务字段或事件正文导出；动作审批还关联一次性nonce与参数/manifest身份绑定。Windows默认DPAPI，POSIX默认AES-GCM加密文件。',['models','governance']);
edge('persistence','database',[[1640,2114],[1640,2198],[281,2198],[281,2240]],'Core-owned 持久化','data');

panel('externalPanel',1342,2240,1340,348,'外部资源与可替换集成','模型、工具与操作系统各有独立协议和边界','neutral');
node('modelExternal',1378,2336,392,206,'模型 API / Agent Harness',['OpenAI Chat / Responses','Anthropic / 兼容提供方','ACP stdio / opencode HTTP','headless JSONL / TUI ConPTY'], 'neutral',P+'Models/Harness/AgentChatClientFactory.cs:18','API 协议与外部 agent harness 都由 Models 适配。这里列的是接入能力，具体可用性依赖提供方配置和机器上的运行程序。',['models']);
node('toolResources',1794,2336,432,206,'本机工作区 / 操作系统',['文件系统 / Git / worktree','Shell、子进程与本地终端','本地执行目标 / snapshots','远程/浏览器环境完整 provider 待闭环'], 'neutral',P+'AgentGraph/ToolExecutionTargetResolver.cs','工具实际操作工作区或受分配的本地执行目标。资源账本、快照和真实执行隔离是不同机制。',['toolFiles','toolGit','sandbox','agentGraph']);
node('mcpExternal',2250,2336,396,104,'外部 MCP server',['stdio · 可扩展工具目录'], 'neutral','TinadecTools/Tools/Mcp/McpRuntime.cs','Tools 连接配置的 stdio MCP server；具体外部工具副作用依然受到 Core 调用授权与 MCP invoke 审批约束。',['toolMcp']);
node('networkExternal',2250,2458,396,96,'网络与外部远端',['公网 fetch / Git remotes'], 'neutral','TinadecTools/Tools/Web/WebFetchTool.cs','公网HTTP(S)地址约束适用于web_fetch。Git remote可使用SSH/非公网地址，不继承WebFetchGuard的公网限制。',['toolWeb','toolGit']);

panel('releasePanel',2718,2240,1466,348,'质量、契约与交付 / 横切工程','源码与 CI 配置核对；本轮没有重跑全产品或发布实机','neutral');
node('quality',2754,2336,446,206,'tests / 契约与架构门禁',['Core 4 套 / Tools / 契约快照','Gateway Bun / Desktop Vitest','UIE / Electron / native / scripts','OpenAPI snapshot / client drift'], 'neutral','TinadecCore/tests/TinadecCore.Architecture.Tests/ArchitectureTests.cs','活动测试保护模块引用、运行事实、授权、契约和UI；旧tests/Tinadec.Contracts.Tests是不在活动sln且不可构建的遗留需求证据，不能作为当前验收入口。图不代表测试全绿。',['contracts','runtime','generators']);
node('release',3224,2336,446,206,'scripts / CI / 三平台制品',['win-x64：NSIS + portable','linux-x64：deb / osx-arm64：dmg','Core / Gateway / Tools 模块包','AgentPack / catalog / SHA256'], 'neutral','.github/workflows/desktop-release.yml:69','原生平台 runner 执行 staging/打包/校验。完整 Office 安装器与独立运行时模块/AgentPack 同时发布，版本和 digest 分别记录。',['serviceManager','packs','nativeAssets']);
node('managerExternal',3694,2336,454,206,'GitHub Release / Manager',['发布 artifacts / channel catalog','Manager 消费模块与版本契约','App 读取机器注册仍待接通','AgentPack 安装仍交由 Core'], 'partial','docs/tinadec-office-release-contract.zh-CN.md','Manager是仓库外消费者。发布产物/模块元数据与catalog已有实现，但当前serviceManager只读内置runtime，未接机器注册；规范中的Office注册交接属于目标。Core NuGet可打包与已发布另行区分。',['release','serviceManager','agentConfig'],null,true);

panel('limitsPanel',56,2640,4128,232,'读图边界 / 当前已实现与仍需完善的部分','以 2026-10-05 的 b6115e6 + 当前工作树为静态核对基线','partial');
node('limits1',92,2730,1000,106,'执行与治理仍有后续工程',['独立执行子 run / 专用 mailbox / 改派与多目标分配未整体闭环'], 'partial','docs/agent-graph/review-2026-10-01.zh-CN.md','任务级并发、唤醒与治理 run control 的可验证切片存在，但不能写成完整双层集群架构已交付。',['dmaea','runtime','agentGraph'],null,true);
node('limits2',1120,2730,1000,106,'上下文与演化仍有后续工程',['事件驱动压缩 / 完整演化评估与 canary / restore-plan UX'], 'partial','docs/tinadec-core-product-definition.zh-CN.md','已有上下文组装、候选与证据机制；完整压缩、演化闭环与恢复计划 UX 尚未完成。',['context','evolution','lifecycle'],null,true);
node('limits3',2148,2730,1000,106,'传输与插件仍有明确缺口',['上游 WS 未接通 / 通用 SkillProvider skeleton / 可选 Tool Runtime'], 'partial','TinadecGateway/src/index.ts:2326','使用虚线边框标记当前半成品、可选集成或未闭环。没有把架构目标当作已运行的服务。',['wsPartial','skills','optionalRuntime'],null,true);
node('limits4',3176,2730,972,106,'证据范围',['源码 / 工程引用 / 注册 / CI；本轮仅渲染与图形检查'], 'partial','docs/architecture-views/overview-2026-10-05/README.zh-CN.md','没有重跑业务测试、真实供应商模型、内核隔离或安装器。最终图的可读性与工程覆盖由本轮实际检查。',['quality'],null,true);

// Hidden conceptual routes are shown in click details, avoiding unreadable crossing lines.
const hidden = [
  ['directTools','Core DirectToolEndpoints',P+'AspNetCore/Endpoints/DirectToolEndpoints.cs','无状态工具目录/只读执行入口，路径根与工具调用仍归 Core。'],
  ['userActions','Core UserToolActionService',P+'Runtime/UserToolActionService.cs','用户写动作：创建 durable action → 快照 → 权限/审批 → 工具 → 结果与审计；不是伪造 agent run。'],
  ['terminals','Core 管理的智能体终端',P+'Tools/TerminalSessionRegistry.cs','Core terminal registry 接收工具子进程终端事件，端点由 AspNetCore 投影；区别于 Desktop 用户 IPC 终端。'],
  ['dmaea','DmaEA 模块',P+'DmaEA/FullDuplexRunEngine.cs','图中双层运行框的统称；本轮覆盖受理、冻结、阶段推进、执行、监督、回答及候选旁路。'],
];
edge('api','aspnet',[[2104,492],[2136,492]],'','core');
edge('aspnet','runtime',[[2730,492],[2762,492]],'','core');
edge('uiCards','uiEngine',[[484,1278],[458,1278]],'','app');
edge('contracts','abstractions',[[2136,1856],[2104,1856]],'','neutral');
const lookup = Object.fromEntries([...nodes.map(n=>[n.id,n]),...hidden.map(([id,title,source,detail])=>[id,{id,title,source,detail,relations:[]}])]);
for (const n of nodes) for (const id of n.relations) if (!lookup[id]) throw new Error('Unknown relation: '+n.id+' -> '+id);
const projects = fs.readdirSync(path.join(repo,'TinadecCore'),{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name!=='tests').flatMap(e=>fs.readdirSync(path.join(repo,'TinadecCore',e.name)).filter(f=>/\.(cs|fs)proj$/.test(f)).map(()=>e.name)).sort();
const covered = nodes.filter(n=>n.module).map(n=>n.module).sort();
if (JSON.stringify(projects)!==JSON.stringify(covered)) throw new Error('Core project coverage differs: '+JSON.stringify({projects,covered}));

const esc = s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const parts = [];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="diagram-title diagram-desc"><title id="diagram-title">TinadecOffice 项目总架构图</title><desc id="diagram-desc">四个独立产品的当前集成架构，展开全部24个Core工程、客户端、网关、工具执行、数据与交付模块。虚线框表示可选或未闭环能力。</desc><defs>`);
for (const [k,c] of Object.entries(colors)) parts.push(`<marker id="arrow-${k}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0 0L8 4L0 8z" fill="${c.ink}"/></marker>`);
parts.push(`</defs><style>text{font-family:'Segoe UI','Microsoft YaHei','PingFang SC',sans-serif;fill:#223148}.node-title{font-size:25px;font-weight:650}.node-line{font-size:22px;fill:#526177}.node rect{transition:opacity .1s;stroke-width:1.6}.node:focus{outline:none}.node:focus rect,.node.selected rect{stroke:#172e55;stroke-width:4}.node.dim{opacity:.22}.node.related rect,.node.match rect{stroke:#1c58b3;stroke-width:3}.panel-title{font-size:30px;font-weight:700}.panel-sub{font-size:21px;fill:#526177}.edge{stroke-width:2.5;fill:none}.edge-label{font-size:20px;font-weight:600;fill:#22754e}</style><rect width="${W}" height="${H}" fill="#fff"/>`);
parts.push(`<text x="56" y="82" style="font-size:49px;font-weight:750;letter-spacing:1px">TinadecOffice · 项目总架构图</text><text x="56" y="128" style="font-size:24px;fill:#526177">四产品边界 / 全部 24 个 Core 工程 / 运行主链 / 业务状态 / 原生能力 / 工具与平台 / 交付</text><text x="4184" y="82" text-anchor="end" style="font-size:25px;font-weight:650">2026-10-05 · b6115e6 + 工作树</text><text x="4184" y="128" text-anchor="end" style="font-size:23px;fill:#526177">实线：当前主链　虚线框：可选 / 待完善　点击框查看职责和源码</text>`);
parts.push(`<text x="56" y="310" style="font-size:22px;fill:#245cb0">HTTP / SSE ↔</text><text x="922" y="310" style="font-size:22px;fill:#087f8c">HTTP / SSE ↔ Core</text><text x="1474" y="310" style="font-size:22px;fill:#7353ae">唯一业务状态与授权权威；治理层与执行层职责分开</text><text x="3440" y="310" style="font-size:22px;fill:#b8671d">↔ stdio JSON Lines；本机无固定工具 HTTP 端口</text>`);
for (const p of panels) {
  const c=colors[p.theme];
  parts.push(`<g class="panel" id="panel-${p.id}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="20" fill="${c.soft}" stroke="${c.line}" stroke-width="1.8"/><text class="panel-title" x="${p.x+30}" y="${p.y+43}" style="fill:${c.ink}">${esc(p.title)}</text><text class="panel-sub" x="${p.x+30}" y="${p.y+75}">${esc(p.subtitle)}</text></g>`);
}
for (const n of nodes) {
  const c=colors[n.theme];
  parts.push(`<g class="node" id="node-${n.id}" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(n.title+'。'+n.lines.join('。'))}"><title>${esc(n.title+'\n'+n.detail+'\n源码：'+n.source)}</title><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="#fff" stroke="${c.line}"${n.partial?' stroke-dasharray="8 6"':''}/><rect x="${n.x}" y="${n.y+12}" width="5" height="${n.h-24}" rx="2.5" fill="${c.ink}" stroke="none"/><text class="node-title" x="${n.x+22}" y="${n.y+38}" style="fill:${c.ink}">${esc(n.title)}</text>`);
  n.lines.forEach((s,i)=>parts.push(`<text class="node-line" x="${n.x+22}" y="${n.y+73+i*29}">${esc(s)}</text>`));
  parts.push('</g>');
}
for (const e of edges) {
  const c=colors[e.theme], d=e.points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ');
  parts.push(`<g data-edge="${e.from}:${e.to}"><path class="edge" d="${d}" stroke="${c.ink}" marker-end="url(#arrow-${e.theme})"${e.both?` marker-start="url(#arrow-${e.theme})"`:''}${e.dashed?' stroke-dasharray="8 5"':''}/>`);
  if(e.label){const p=e.points[2]??e.points[0];parts.push(`<text class="edge-label" x="${p[0]+15}" y="${p[1]-10}">${esc(e.label)}</text>`);}
  parts.push('</g>');
}
parts.push(`<text x="56" y="2930" style="font-size:25px;font-weight:650">一次交互：用户意图 → 201 受理与冻结 → 计划 → 执行者 / 模型 / 工具 → 监督 → meeting 回答 → SSE / 消息落地</text><text x="56" y="2975" style="font-size:23px;fill:#526177">写入支路：Core 快照与授权 / 审批 → 冻结调用与可信宿主请求 → Tools 路径、确认、沙箱校验 → 执行结果 / 审计 / 恢复判断</text><text x="56" y="3020" style="font-size:21px;fill:#526177">本图依据当前源码、工程引用、DI 注册、配置和 CI 核对；覆盖主要架构模块，不逐列所有类、端点和文件。源码索引与图形验证见配套说明。</text></svg>`);
const svg=parts.join('\n');
fs.writeFileSync(path.join(here,'tinadecoffice-overview.svg'),svg);
fs.writeFileSync(path.join(here,'architecture-model.json'),JSON.stringify({baseline:'b6115e6 + working tree',date:'2026-10-05',width:W,height:H,projects,nodes,edges,lookup},null,2));

const browserData=JSON.stringify(lookup).replaceAll('<','\\u003c');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TinadecOffice 项目总架构图</title><style>
*{box-sizing:border-box}body{margin:0;color:#223148;background:#e9eef4;font:14px 'Segoe UI','Microsoft YaHei',sans-serif}button,input{font:inherit}header{height:70px;background:#fff;border-bottom:1px solid #d0d9e5;display:flex;align-items:center;gap:10px;padding:12px 18px;flex-wrap:wrap}header strong{font-size:18px;margin-right:10px}button{background:#fff;border:1px solid #becbdc;border-radius:7px;padding:8px 12px;cursor:pointer;color:#223148}button:hover{background:#edf4ff}button:focus-visible,input:focus-visible{outline:3px solid #245cb0;outline-offset:2px}input{min-width:180px;width:230px;border:1px solid #becbdc;border-radius:7px;padding:8px 12px}.help{font-size:12px;color:#596b82}#stage{position:relative;height:calc(100vh - 70px);overflow:hidden;touch-action:none;cursor:grab;background:radial-gradient(#cbd4df .65px,transparent .65px);background-size:16px 16px}#stage.dragging{cursor:grabbing}#canvas{position:absolute;left:0;top:0;transform-origin:0 0;width:${W}px;height:${H}px;box-shadow:0 6px 40px #31476222}#canvas svg{display:block}#canvas .node{cursor:pointer}aside{position:fixed;right:18px;top:86px;bottom:18px;width:360px;max-width:calc(100vw - 36px);background:#fff;border:1px solid #ccd7e4;border-radius:12px;padding:20px;overflow:auto;box-shadow:0 8px 30px #26384d22;display:none}aside.open{display:block}aside h2{font-size:21px;line-height:1.5;margin:10px 0 14px}aside p{line-height:1.8;margin:12px 0}aside code{display:block;word-break:break-all;font-size:12px;background:#f2f5f8;padding:10px;border-radius:6px}aside .relations button{display:block;text-align:left;width:100%;margin:7px 0}#close{float:right;padding:5px 9px}#notice{position:fixed;left:18px;bottom:16px;background:#fff;border:1px solid #ccd7e4;padding:9px 12px;border-radius:7px;font-size:12px;color:#526177}#percent{font-variant-numeric:tabular-nums;min-width:43px;text-align:center}@media(max-width:850px){header{height:112px;gap:7px}header strong{width:100%}#stage{height:calc(100vh - 112px)}aside{top:125px}.help{display:none}}@media print{header,aside,#notice{display:none}#stage{overflow:visible;background:none;height:auto}#canvas{transform:none!important;position:static;box-shadow:none}body{background:#fff}}
</style></head><body><header><strong>TinadecOffice 总架构图</strong><button id="fit">全图</button><button id="minus" aria-label="缩小">−</button><span id="percent" aria-live="polite"></span><button id="plus" aria-label="放大">+</button><button id="actual">100%</button><input id="search" type="search" aria-label="搜索模块" placeholder="搜索模块，例如 Models / 审批"><button id="clear">清除</button><button id="download">导出 SVG</button><span class="help">滚轮缩放 · 空白处拖动 · 点击模块查职责与源码 · Esc 关闭详情</span></header><main id="stage" aria-label="可拖动缩放的架构图"><div id="canvas">${svg}</div></main><aside id="detail" aria-label="模块详情"><button id="close" aria-label="关闭详情">×</button><h2 id="detail-title"></h2><p id="detail-body"></p><p><strong>源码位置</strong></p><code id="detail-source"></code><p><strong>相关模块</strong></p><div class="relations" id="detail-relations"></div></aside><div id="notice">24 / 24 Core 工程已覆盖 · 虚线框表示可选或待完善 · 完全离线可用</div><script>
const data=${browserData},stage=document.getElementById('stage'),canvas=document.getElementById('canvas'),detail=document.getElementById('detail');
let scale=1,x=0,y=0,drag=null;
const clamp=v=>Math.max(.12,Math.min(2,v));
function apply(){canvas.style.transform='translate('+x+'px,'+y+'px) scale('+scale+')';document.getElementById('percent').textContent=Math.round(scale*100)+'%'}
function fit(){scale=Math.min((stage.clientWidth-36)/${W},(stage.clientHeight-36)/${H});x=(stage.clientWidth-${W}*scale)/2;y=(stage.clientHeight-${H}*scale)/2;apply()}
function zoom(next,cx=stage.clientWidth/2,cy=stage.clientHeight/2){next=clamp(next);x=cx-(cx-x)*next/scale;y=cy-(cy-y)*next/scale;scale=next;apply()}
function focus(id){const n=data[id];if(!n)return;document.querySelectorAll('.node').forEach(el=>{const related=n.relations?.includes(el.dataset.id);el.classList.toggle('selected',el.dataset.id===id);el.classList.toggle('related',!!related);el.classList.toggle('dim',el.dataset.id!==id&&!related)});document.getElementById('detail-title').textContent=n.title;document.getElementById('detail-body').textContent=n.detail;document.getElementById('detail-source').textContent=n.source;const r=document.getElementById('detail-relations');r.replaceChildren();for(const rel of n.relations||[]){const b=document.createElement('button');b.textContent=data[rel].title;b.onclick=()=>{focus(rel);centerNode(rel)};r.appendChild(b)}detail.classList.add('open')}
function centerNode(id){const n=data[id];if(!Number.isFinite(n.x))return;scale=Math.max(scale,.65);x=(stage.clientWidth-390)/2-(n.x+n.w/2)*scale;y=stage.clientHeight/2-(n.y+n.h/2)*scale;apply()}
function reset(){detail.classList.remove('open');document.querySelectorAll('.node').forEach(el=>el.classList.remove('selected','related','dim','match'));document.getElementById('search').value=''}
stage.addEventListener('wheel',e=>{e.preventDefault();const r=stage.getBoundingClientRect();zoom(scale*Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
stage.addEventListener('pointerdown',e=>{if(e.target.closest('.node'))return;drag={px:e.clientX,py:e.clientY,x,y};stage.setPointerCapture(e.pointerId);stage.classList.add('dragging')});stage.addEventListener('pointermove',e=>{if(!drag)return;x=drag.x+e.clientX-drag.px;y=drag.y+e.clientY-drag.py;apply()});function drop(){drag=null;stage.classList.remove('dragging')}stage.addEventListener('pointerup',drop);stage.addEventListener('pointercancel',drop);
document.querySelectorAll('.node').forEach(el=>{el.addEventListener('click',()=>focus(el.dataset.id));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();focus(el.dataset.id)}})});
document.getElementById('fit').onclick=fit;document.getElementById('plus').onclick=()=>zoom(scale*1.25);document.getElementById('minus').onclick=()=>zoom(scale/1.25);document.getElementById('actual').onclick=()=>zoom(1);document.getElementById('close').onclick=reset;document.getElementById('clear').onclick=reset;document.addEventListener('keydown',e=>{if(e.key==='Escape')reset()});
document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();detail.classList.remove('open');document.querySelectorAll('.node').forEach(el=>{const n=data[el.dataset.id],hit=(n.title+' '+n.lines.join(' ')+' '+n.detail).toLowerCase().includes(q);el.classList.remove('selected','related');el.classList.toggle('dim',!!q&&!hit);el.classList.toggle('match',!!q&&hit)})});
document.getElementById('download').onclick=()=>{const clone=canvas.querySelector('svg').cloneNode(true);clone.querySelectorAll('.node').forEach(el=>el.setAttribute('class','node'));const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tinadecoffice-overview.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)};
window.addEventListener('resize',fit);fit();window.architectureView={fit,focus,reset,zoom,getState:()=>({scale,x,y}),nodeCount:${nodes.length}};
</script></body></html>`;
fs.writeFileSync(path.join(here,'tinadecoffice-overview.html'),html);
console.log(JSON.stringify({projects:projects.length,modulesCovered:covered.length,nodes:nodes.length,edges:edges.length,outputs:['tinadecoffice-overview.svg','tinadecoffice-overview.html','architecture-model.json']}));
