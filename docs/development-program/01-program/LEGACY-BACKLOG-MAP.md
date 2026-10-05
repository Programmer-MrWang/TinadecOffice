# 既有TODO与本工程的衔接

新工程不会直接把旧[x]复制为功能完成，也不会把旧“未做”复制为当前缺口。旧文档保留历史，其具体需求与证据逐项进入主责模块TODO。

| 旧来源 | 当前入口 | 导入规则 |
| --- | --- | --- |
| [图工程复查](../../agent-graph/review-2026-10-01.zh-CN.md) | CORE-DMAEA / CORE-TINACHAT / CORE-AGENT-GRAPH / CORE-RUNTIME / CORE-CONTEXT | N4–N9逐条对源；N7中POSIX未实现说法已过期 |
| [图工程施工TODO](../../agent-graph/todo.zh-CN.md) | 对应Core与App模块 | 具体条目附文件+章节；同名N9与review含义不同 |
| [正式eval](../../whole-product-eval-2026-10-05.zh-CN.md) | APP-CODE / APP-RENDERER / APP-HOME / GW-STREAMING / X-QUALITY | 问题先当前复验；历史崩溃/绿测不可覆盖当前结论 |
| [模型设置审查](../../model-settings-review-2026-10-05.zh-CN.md) | APP-SETTINGS / CORE-MODELS / CORE-GOVERNANCE | 已修切片保留历史证据，余项需具体再验 |
| [Home入场](../../home-entry-motion-2026-10-05.zh-CN.md) / [Market稳定性](../../market-route-stability-2026-10-05.zh-CN.md) | APP-HOME / APP-MARKET / APP-UIE-COMPONENTS | 当前修复存在，勿重新登记成未实现 |
| [Gateway稳定性](../../gateway-stability-2026-10-05.zh-CN.md) | GW-STREAMING | signal修复存在，长期/版本验收另跟踪 |
| [Debug规划](../../agent-debug-studio-plan.md) | APP-DEBUG / CORE-HTTP | 已有界面和桩分开，具体后端范围仍需目标定义 |
| [Git路线图](../../git-module-status-and-roadmap.md) | TOOLS-GIT / APP-CODE | 读写/远端/恢复逐项核对，不继承整模块完成结论 |
| [旧Contracts测试证据](../../../tests/Tinadec.Contracts.Tests/README.md) | X-QUALITY / CORE-CONTRACTS | 不可构建、不在活动sln，只可作需求证据 |

后续迁移时给每个旧任务记录：原文件/章节 → 当前Task ID → 来源结论的验证级别 → 是否被实现或新决策替代。未迁完的旧任务不能从历史文档直接删除。
