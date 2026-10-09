# Skills · 市场与集成配置：模块架构

模块ID：`CORE-SKILLS` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["Skills · 市场与集成配置"]
    scope["模块整体"]
    f0["Skills · 市场与集成配置"]
  end
  r0["Context · 本轮输入与补丁"]
  scope ---|"职责关联，方向待精化"| r0
  r1["Market / 市场"]
  scope ---|"职责关联，方向待精化"| r1
  r2["Tools · 工具治理与适配"]
  scope ---|"职责关联，方向待精化"| r2
  subgraph C["已核对的 ProjectReference"]
    cp["Skills"]
    c0["Abstractions"]
    cp -->|"编译引用"| c0
    c1["Persistence"]
    cp -->|"编译引用"| c1
  end
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| Skills · 市场与集成配置 | 市场目录与受控安装、集成配置已实现；通用 ListSkillsAsync/GetSkillAsync 仍为空实现。实际工作区 SKILL.md 的读取在 Context。 | [TinadecCore/Skills/SkillsModuleRegistrar.cs:43](../../../../../TinadecCore/Skills/SkillsModuleRegistrar.cs#L43) |

## 已核对的编译引用

工程文件：[TinadecCore/Skills/TinadecCore.Skills.csproj](../../../../../TinadecCore/Skills/TinadecCore.Skills.csproj)。

- Abstractions
- Persistence

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[CORE-SKILLS-001](TODO.md#core-skills-001)。

## 2026-10-08 工具技能资源

```mermaid
flowchart LR
  API["ToolSkillEndpoints"] -->|"资源目录/条件编辑"| Service["ToolSkillResourceService"]
  Service -->|"共享包元数据与内容寻址版本"| Shared["IntegrationDbContext / 包目录"]
  Service -->|"项目skills发现与校验"| Discover["WorkspaceSkillDiscovery / Policy"]
  Service -->|"项目修改的治理动作"| Action["UserToolActionService"]
  Context["运行技能索引"] -->|"共享真实发现策略与配置摘要"| Discover
  Resolver["ToolConfigurationResolver"] -->|"冻结准确包ID及窄只读根"| Service
```

箭头依据：[资源服务](../../../../../TinadecCore/Skills/ToolSkillResourceService.cs)、[发现](../../../../../TinadecCore/Abstractions/Ports/WorkspaceSkillDiscovery.cs)、[Context接线](../../../../../TinadecCore/Context/ContextModuleRegistrar.cs)、[配置解析](../../../../../TinadecCore/Tools/ToolConfigurationResolver.cs)。精确绑定失效不给同名替代；项目写入保留审批和哈希，共享正文/资产保留旧版本供运行继续读取。

## 2026-10-09 源码、版本与安装分离

```mermaid
flowchart LR
  Market["市场或资源编辑"] -->|"预览完整包、revision与文件摘要"| Review["治理审批"]
  Review -->|"预条件仍匹配"| Live["当前scope skills源码"]
  Live -->|"项目仅.tinadec/skills；共享用scope Skills"| Catalog["验证与目录查询"]
  Live -->|"替换失败恢复原文件；卸载删除真实源"| Config["config/integrations.toml权威；DB投影"]
  Catalog -->|"准入enabled且selected完整包"| Versions["scope packages/skills或project-skills"]
  Versions -->|"不可变路径和hash"| Frozen["本run冻结索引与只读根"]
  Update["下一次源码更新或卸载"] -->|"历史版本保留"| Versions
  Catalog -->|"MCP登记只是配置"| Program["Tools独立程序安装审批"]
```

管理读取 live 文件，Agent 可编辑配置与技能源码；源码字节变化更新条件修订，旧审阅不得覆盖新内容。运行准入才生成不可变副本，不从 live 目录继续读取。资源路径取 `IScopeStorageLocations.Root/Skills/Packages/Temp`，不将 `StoragePaths.Root`（Data）当包源。MCP程序目录和安装manifest由Tools拥有，市场预览不下载依赖。详见[实施与验证](../../../../../.tinadec_dev/reports/2026-10-09-storage-resources.zh-CN.md)。
