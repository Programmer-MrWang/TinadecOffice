# Core Agent Mode 准入错误接线补强

关联唯一任务：APP-HOME-107。日期：2026-10-10。环境：Windows、.NET SDK 10.0.303 / 测试运行时 10.0.11、SQLite；复用独立 artifacts `.tinadec_dev/tmp/workspace-api-trace`。

## 实现与验证范围

StorageEndpoints 的三个 `agent_mode_not_configured` 分支（新会话缺默认模式、所选模式缺 conversation 节点、PATCH clear 后缺默认模式）共用一个 ProblemDetails helper。原始 HTTP 409、错误码、三段消息及准入条件保留；响应同时保留 message 和 detail。现有 AddProblemDetails 补 `user_action_required`、`retryable=false`、`actions=[open_settings]` 和非空 trace_id。

单个用例 `StorageApiTests.MissingDefaultMode_CreateAndClearReturnClassifiedProblemsWithoutPartialWrites` 通过真实 Program / StorageEndpoints HTTP 管线及独立 SQLite：先经 POST 创建合法会话，仅清除测试 DB 中的默认指针，随后验证新建与 PATCH clear 拒绝的完整错误契约。已发布模式和原会话保留；标题、冻结 mode、settings_revision 均不变，不留下额外会话。工厂前置未改，用户配置、登记与运行服务未操作。

## 命令与准确结果

```text
dotnet.exe test TinadecCore/tests/TinadecCore.Api.Tests/TinadecCore.Api.Tests.csproj --filter FullyQualifiedName~MissingDefaultMode_CreateAndClearReturnClassifiedProblemsWithoutPartialWrites --artifacts-path .tinadec_dev/tmp/workspace-api-trace --no-restore --logger "console;verbosity=normal" --blame-hang --blame-hang-timeout 3m
```

最终 exec_command 会话 37908：**退出码 0，1/1 通过，测试体 30 秒，总测试时间 42.0652 秒**。git diff --check 通过。现有其他测试的 nullable / xUnit 等编译告警仍在，本轮没有展开修改。

```text
[xUnit.net 00:00:33.04]   Finished:    TinadecCore.Api.Tests
数据收集器“Blame”消息: 所有测试都已运行完毕，将不生成序列文件。
  已通过 TinadecCore.Api.Tests.StorageApiTests.MissingDefaultMode_CreateAndClearReturnClassifiedProblemsWithoutPartialWrites [30 s]

测试运行成功。
测试总数: 1
     通过数: 1
总时间: 42.0652 秒
```

## 此前失败也保留

完整试验会话 13135 **退出码 1，1/1 失败，总时间 57.2987 秒**。失败发生在测试前置第43行：错误假定 legacy factory 启动后没有默认模式；实际 bootstrap pack 已提供默认模式，尚未测试产品拒绝响应。修正仅限 owned 测试状态，改为先真实创建会话、再清默认指针，随后得到上述最终通过结果。早先测试编译还出现 ListSessionsAsync 遗漏显式 projectId 参数，已改为 null；不将这些失败计为产品回归。

```text
[xUnit.net 00:00:50.69]     TinadecCore.Api.Tests.StorageApiTests.MissingDefaultMode_CreateAndClearReturnClassifiedProblemsWithoutPartialWrites [FAIL]
[xUnit.net 00:00:50.70]       Assert.False() Failure
[xUnit.net 00:00:50.70]       Expected: False
[xUnit.net 00:00:50.70]       Actual:   True
[xUnit.net 00:00:50.70]       Stack Trace:
[xUnit.net 00:00:50.70]         C:\git\agent\TinadecOffice\TinadecCore\tests\TinadecCore.Api.Tests\StorageApiTests.cs(43,0): at TinadecCore.Api.Tests.StorageApiTests.MissingDefaultMode_CreateAndClearReturnClassifiedProblemsWithoutPartialWrites()
[xUnit.net 00:00:50.70]         C:\git\agent\TinadecOffice\TinadecCore\tests\TinadecCore.Api.Tests\StorageApiTests.cs(43,0): at TinadecCore.Api.Tests.StorageApiTests.MissingDefaultMode_CreateAndClearReturnClassifiedProblemsWithoutPartialWrites()
[xUnit.net 00:00:50.70]         --- End of stack trace from previous location ---
[xUnit.net 00:00:50.83]   Finished:    TinadecCore.Api.Tests
数据收集器“Blame”消息: 所有测试都已运行完毕，将不生成序列文件。
  失败 TinadecCore.Api.Tests.StorageApiTests.MissingDefaultMode_CreateAndClearReturnClassifiedProblemsWithoutPartialWrites [47 s]
  错误消息:
   Assert.False() Failure
Expected: False
Actual:   True
  堆栈跟踪:
     at TinadecCore.Api.Tests.StorageApiTests.MissingDefaultMode_CreateAndClearReturnClassifiedProblemsWithoutPartialWrites() in C:\git\agent\TinadecOffice\TinadecCore\tests\TinadecCore.Api.Tests\StorageApiTests.cs:line 43
   at TinadecCore.Api.Tests.StorageApiTests.MissingDefaultMode_CreateAndClearReturnClassifiedProblemsWithoutPartialWrites() in C:\git\agent\TinadecOffice\TinadecCore\tests\TinadecCore.Api.Tests\StorageApiTests.cs:line 43
--- End of stack trace from previous location ---

测试总数: 1测试运行失败。

     失败数: 1
总时间: 57.2987 秒
```

执行过程中的 PowerShell 包装出现退出空输出而留下 dotnet 子进程，未将其作为通过证据；经核实 PID 后停止本轮重复测试树，并改用可轮询的 cmd / exec_command。用户 Core 未停止。最终验证仅使用会话37908的准确退出结果。

## 未宣称与后续边界

三个分支共用 helper 的接线已核对，单例运行覆盖缺默认模式 create 与 PATCH clear；本轮不再复制 conversation-node 镜像用例。已有会话发送链的 InteractionsEndpoints 仍有同码 raw Conflict，是历史缺绑定会话的交互准入分支；成功的新会话先已有冻结 mode，因此不属于本次已确认的创建失败链，未扩展修改。未重跑全 API 套件、Linux/macOS、PostgreSQL、完整安装包或另一次 Electron 界面验收。
