# 质量、契约与验收门禁：模块架构

模块ID：`X-QUALITY` · 基线：2026-10-05，b6115e6 + 当前工作树。

![模块职责与关联图](architecture.svg)

这是总图的**模块职责投影**：实线无箭头表示相关职责，不表示调用先后。逐模块审计任务将补充成功/失败、控制流、数据流和恢复关系；仅ProjectReference箭头表示已从工程文件读出的编译依赖。

## 可编辑架构图

```mermaid
flowchart LR
  subgraph S["质量、契约与验收门禁"]
    scope["模块整体"]
    f0["tests / 契约与架构门禁"]
  end
  r0["Contracts · 对外契约类型"]
  scope ---|"职责关联，方向待精化"| r0
  r1["Runtime · 唯一组合根"]
  scope ---|"职责关联，方向待精化"| r1
  r2["TinadecTools.Generators / 构建期生成器"]
  scope ---|"职责关联，方向待精化"| r2
```

## 模块边界与输入/输出

| 职责 | 当前边界 | 来源 |
| --- | --- | --- |
| tests / 契约与架构门禁 | 活动测试保护模块引用、运行事实、授权、契约和UI；旧tests/Tinadec.Contracts.Tests是不在活动sln且不可构建的遗留需求证据，不能作为当前验收入口。图不代表测试全绿。 | [TinadecCore/tests/TinadecCore.Architecture.Tests/ArchitectureTests.cs](../../../../../TinadecCore/tests/TinadecCore.Architecture.Tests/ArchitectureTests.cs) |

## 继续精化时必须补齐

- 实际入口、调用方向与状态所有者；每个有向关系有源码依据。
- 成功与错误/取消路径、身份/权限边界、异步与恢复时序。
- 哪些是Core内部端口、哪些跨进程/HTTP/stdio，哪些仅是UI职责关联。
- 已确认缺口使用不同标记；目标图与当前图分别说明，避免合并成假现状。

任务入口：[X-QUALITY-001](TODO.md#x-quality-001)。
