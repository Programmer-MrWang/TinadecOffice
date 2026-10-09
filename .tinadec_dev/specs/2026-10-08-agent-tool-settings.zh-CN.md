# Agent 工具设置契约

关联模块：APP-SETTINGS、Core Tools、Core Skills、TOOLS-PROTOCOL、TOOLS-MCP。用户批准的实施方案，2026-10-08。

设置入口为“工具 / Tools”，包含总览、Shell、文件、搜索、Git、网页、MCP、Skills、高级配置九个标签。普通页面管理资源和绑定，行为参数只在严格 JSON 编辑器中修改，保存后只影响后续准入运行。AgentCenter 继续独占 tool_scope 的编辑权。

行为配置为当前 Core 租户/工作区的共享默认与持久 AgentDefinitionId 的稀疏覆盖。项目仅限定资源可见性；没有项目行为层。Agent 资源字段省略表示继承，显式 null 表示所有当前可用资源，空数组不给资源，显式数组精确绑定稳定 ID。数组整体替换，删除覆盖字段恢复继承。核心授权、共享限制、审批、文件哈希、路径与链接边界、网页地址防护不能被覆盖撤销。

共享默认、Agent 覆盖、MCP 托管资源保存在 Core 的版本化关系库，SQLite/PostgreSQL 各有迁移。PUT/DELETE 的 If-Match 必填，缺少返回 428，过期返回 412。公共响应不包含 MCP 凭据；SecretStore 引用版本进入冻结记录，执行时才解析。

项目 Skills 来源保持 skills/**/SKILL.md；共享包使用 Core 的独立内容寻址目录，每个版本保留正文与相对引用资源。目录与上下文共用 WorkspaceSkillDiscovery 和 WorkspaceSkillPolicy。项目同名资源优先于共享资源；精确绑定不会自动换成同名资源。绑定控制提供给 Agent 的技能索引，不撤销普通项目文件权限。

工具请求的 execution_context 是 Core 填充的独立字段，不能混入模型 params。配置、资源和读取根来自准入冻结；工具端每次调用独立进入不可变 AsyncLocal 上下文。Shell、command_run、读取和目录、搜索、Git、网页及 MCP 通过遗漏参数默认值与不可放宽的边界接线。未传参数与显式 false/数值分别处理。

新 MCP 配置版本使用资源、版本、命令、参数和环境指纹区分连接。当前运行继续持有旧版本；运行完成释放其连接租约。保存设置不重启工具宿主。托管模式仅使用 Core 资源库；独立 TinadecTools 保留原文件模式。既有 MCP 文件非破坏导入；市场安装、升级与卸载经同一 Core 治理动作写入资源库。

本机真实执行验证范围为 Windows；Linux/macOS 的平台实现与迁移不能用 Windows 编译结果替代运行验收。详细测试与边界记录在同日实施报告。
