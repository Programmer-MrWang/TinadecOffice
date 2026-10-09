# TinadecTools / MCP 扩展：模块架构

模块ID：`TOOLS-MCP` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["TinadecTools / MCP 扩展"]
    scope["模块整体"]
    f0["MCP · 外部工具扩展"]
  end
  r0["Skills · 市场与集成配置"]
  scope ---|"职责关联，方向待精化"| r0
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| MCP · 外部工具扩展 | 当前实现是 stdio MCP client。浏览器等工具可由配置的外部 MCP server 提供；此处不假设自带浏览器自动化或 A2A 运行模块。 | [TinadecTools/Tools/Mcp/McpClientPool.cs:63](../../../../../TinadecTools/Tools/Mcp/McpClientPool.cs#L63) |

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[TOOLS-MCP-001](TODO.md#tools-mcp-001)。

## 2026-10-08 托管版本连接

```mermaid
flowchart LR
  Context["ToolExecutionContext中的准确资源版本"] -->|"托管选择；不回退旧文件"| Repo["McpServerRepository"]
  Repo -->|"资源ID/版本/环境指纹"| Pool["McpClientPool"]
  Pool -->|"stdio连接复用"| Server["外部MCP进程"]
  Run["运行租约及活跃调用"] -->|"保留旧连接，结束后回收"| Pool
```

箭头依据：[资源选择](../../../../../TinadecTools/Tools/Mcp/McpServerRepository.cs)、[连接池](../../../../../TinadecTools/Tools/Mcp/McpClientPool.cs)、[可信上下文](../../../../../TinadecTools/Runtime/ToolExecutionContext.cs)。新版本开新连接，旧运行继续用其版本。Core的导入和市场安装写同一资源库；Tools独立模式仍允许文件配置，不能成为托管运行的第二配置来源。
