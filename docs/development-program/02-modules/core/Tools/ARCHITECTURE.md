# Tools · 工具治理与适配：模块架构

模块ID：`CORE-TOOLS` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["Tools · 工具治理与适配"]
    scope["模块整体"]
    f0["Tools · 工具治理与适配"]
  end
  r0["Governance · 授权与审批"]
  scope ---|"职责关联，方向待精化"| r0
  r1["AgentGraph · 图与资源"]
  scope ---|"职责关联，方向待精化"| r1
  subgraph C["已核对的 ProjectReference"]
    cp["Tools"]
    c0["Abstractions"]
    cp -->|"编译引用"| c0
  end
```

## 2026-10-09 显式 MCP 程序生命周期

```mermaid
flowchart LR
  R["TOML MCP resource registry"] --> P["ManagedMcpProgramService pure preview"]
  P --> U["UserToolActionService approval"]
  U --> I["Tools approved private installer"]
  I --> V["scope packages + installation.toml"]
  V --> A["state/mcp-programs pointer"]
  A --> F["run admission content hash + frozen program root"]
  F --> M["MCP SDK trusted stdio transport"]
  U --> D["uninstall pointer; immutable bytes retained"]
```

preview 不安装或建包目录；真实程序安装是独立审批动作。历史运行保存 program_root/program_hash，不跟随 pointer 更新。工具 prepare/resume 与调用 materialize 验证 frozen scope identity，复制数据不能沿用旧host授权。SDK server 自身不继承 shell OS sandbox，host token 不进入其环境。

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| Tools · 工具治理与适配 | 这是 Core 中的工具治理模块，和右侧实际执行产品 TinadecTools 不同。准备/授权/审批/租约/恢复后才向工具提供方发送可信请求。 | [TinadecCore/Tools/ToolsModuleRegistrar.cs:19](../../../../../TinadecCore/Tools/ToolsModuleRegistrar.cs#L19) |

## 已核对的编译引用

工程文件：[TinadecCore/Tools/TinadecCore.Tools.csproj](../../../../../TinadecCore/Tools/TinadecCore.Tools.csproj)。

- Abstractions

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[CORE-TOOLS-001](TODO.md#core-tools-001)。

## 2026-10-08 版本配置与运行快照

```mermaid
flowchart LR
  API["ToolSettingsEndpoints"] -->|"严格JSON与If-Match"| Store["ToolSettingsStore / ToolsSettingsDbContext"]
  Admission["AgentRuntimeConfigurationResolver：准入"] -->|"参与及可派生定义ID"| Resolver["ToolConfigurationResolver"]
  Resolver -->|"共享与稀疏覆盖"| Store
  Resolver -->|"一次捕获可见版本"| MCP["McpResourceRegistry"]
  Resolver -->|"一次捕获技能包"| Skills["IToolSkillCatalog"]
  Admission -->|"持久冻结配置"| Frozen["FrozenRunConfigurationV1"]
  Frozen -->|"定义/父模板选择原快照"| Dispatch["ToolDispatcher / ScopeResolver"]
  Dispatch -->|"可信execution_context及授权交集"| Host["TinadecTools进程"]
```

箭头依据：[配置端点](../../../../../TinadecCore/AspNetCore/Endpoints/ToolSettingsEndpoints.cs)、[解析实现](../../../../../TinadecCore/Tools/ToolConfigurationResolver.cs)、[准入冻结](../../../../../TinadecCore/DmaEA/FrozenRunConfiguration.cs)、[调用](../../../../../TinadecCore/Tools/ToolDispatcher.cs)、[范围恢复](../../../../../TinadecCore/Tools/ToolInvocationScopeResolver.cs)。凭据引用在冻结配置保留版本，调用前从SecretStore物化；编辑响应不包含实际凭据。恢复、待审批、派生及取消清理消费原快照，保存不重启宿主。
