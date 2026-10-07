# 工具层三条实测确认缺陷（2026-10-08）

范围：只动 `TinadecTools`。三个提交各自带自己的改前读数、改后读数与变异验证。
外部 issue/PR 只作为触发线索，本文全部结论来自本机实跑。

- `2b692f0` fix(tools): hand cmd.exe the command as a raw tail, not an escaped argv
- `132e721` fix(tools): let git_status return the file name the user actually has
- `7151a3c` fix(tools): refuse an option-shaped git_pull branch before git runs

基线：改动前 `tests/TinadecTools.Tests` 354/354。三个提交后 364/364（+5 +3 +2）。

## ① shell 在 Windows 上把引号交给 cmd.exe 时损坏

`ProcessStartInfo.ArgumentList` 按 MSVCRT 规则转义（`"` → `\"`），而 cmd.exe 没有
反斜杠转义这一套。`/d /s /c` 只会剥掉最外层一对引号，里面的反斜杠原样留下，于是
引号不再起分隔作用。

改前实测（真 cmd.exe + 真 git 仓库）：`git commit -m "quoted: two words"` 落到
git 的是带字面反斜杠的参数，git 随后报
`error: pathspec 'two' did not match any file(s) known to git` 与
`error: pathspec 'words"' did not match any file(s) known to git`。
这条读数在动手前确认过一次，改后又用"把参数尾换回 argv"的变异复现了一次，
两边形态一致。

修法：Windows 沙箱路径把整条命令作为**原始参数尾**（`psi.Arguments`）传递，POSIX
仍然走 argv；`SandboxRequestValidator` 拒绝同时携带两种载体、拒绝空尾、拒绝 NUL、
拒绝在非 Windows 上出现尾。`ResolveShell` 与 `EscapeSingleQuoted` 是死代码，删掉。

守卫：`ResolveSandboxCommand_Windows_CarriesTheWholeCommandAsRawTail`、
`ResolveSandboxCommand_Posix_UsesArgvAndNoRawTail`、
`RealCmd_RawTail_EchosInnerQuotesWithoutBackslashes`、
`RealCmd_QuotedCommitMessage_ReachesGitAsOneArgument`（断言真实
`git log -1 --format=%s` == `quoted: two words`）、
`ValidateRequest_RejectsRawTailAlongsideArgv`、`ApplyCommandLine_PicksOneTransport`。

变异：把参数尾换回 argv → 恰 3 条转红，其中包含真实 git 的 pathspec 报错，
不是对我们自己拼的字符串做断言。文件按字节快照还原（MD5 一致）后 359/359。

## ② git_status 交回的是八进制转义，不是用户有的文件名

`status --porcelain=v1` 默认 `core.quotepath=true`，任何非 ASCII 路径都被 C 语言式转义。

改前实测（断言里的集合值就是模型收到的东西）：
`Path = "\344\270\255\346\226\207\346\226\207\344\273\266.txt"`。
行格式还有第二处丢失：改名靠切第一个 `" -> "`，所以路径本身含这段文字会被报成
"自己改名叫自己"。

修法：`--porcelain=v1 --branch -z`——每条记录以 NUL 结尾、路径一律不转义、
改名/复制的来源在**下一条**记录里。同时给 `TerminalRunner` 钉住子进程输出为
UTF-8：只有字节被按 UTF-8 解码，这个"换成原始字节"的交换才成立；git 无论宿主
代码页是什么都写 UTF-8，而本项目另外三个进程 runner 早就钉了。

守卫：`Status_ReturnsNonAsciiPathsVerbatim`（真仓库，修改态与未跟踪态各一条，
且路径里不得出现反斜杠）、`Status_SplitsRenameIntoPathAndPreviousPath`
（真 `git mv`，新名 + `old.txt` 作 previous_path）、
`ParseStatus_TakesTheRenameSourceFromTheNextRecordNotFromAnArrow`。
第三条在记录层面钉，因为 NTFS 禁止 `>`，Windows 上造不出含 `" -> "` 的真实仓库。

变异与读数：
- 去掉 `-z` → 两条真仓库用例转红（就是上面的改前读数）。
- 在新解析器上重新加回箭头切分 → 恰 1 条转红，正是记录契约那条。
- **把编码 pin 改回默认 → 两条中文用例都转红**，形态是教科书式的
  UTF-8 被按 CP936 解：`中文文件.txt` 变成 `涓枃鏂囦欢.txt`。
  这台机器的环境代码页不是 UTF-8，所以 pin 在本机就是有承重的，而且它顺带修好了
  `git_log`/`git_blame`/`git_diff` 一直经由同一个 runner 返回的中文标题、作者与
  diff 行。此前它被藏住了：旧输出里唯一"ASCII 安全"的部分，恰好是错的那部分。

诚实边界：pin 的前提是"孩子说 UTF-8"。对 git 成立（TerminalRunner 只被 GitCli 用），
对 Windows 本地化工具不成立——③里 whoami.exe 的中文报错经这个 runner 就变成乱码。
这不是回归（pin 前它同样错，只是方向相反），但别把它当成通用保证。

## ③ git_pull 的 branch 参数会被 git 读成自己的选项

`git pull <remote> <branch>` 由 git 解析，不是当 refspec。于是 branch 槽里一个
以 `-` 开头的值会传到 `git fetch`，而 `--upload-pack` 指定的是**本地要 exec 的程序**。
remote 早就过 `RemoteExistsAsync`（拒绝前导 `-`），push 的 branch 早就过
`check-ref-format --branch`，只有 pull 的 branch 什么都没查。

改前实测，分两层：
- git 层：`git -c credential.interactive=never pull --ff-only origin
  "--upload-pack=C:/Windows/System32/whoami.exe"` → whoami.exe 真的被执行了，
  并且收到了仓库 URL 作为参数，返回它自己的中文用法错误；同一命令给普通分支名，
  得到的是 `couldn't find remote ref` 这种 ref 层错误。未知选项则报
  `error: unknown option`——这证明该位置确实按选项解析。
- 工具层：`PullAsync` 把上面那段 whoami 输出原样当作 `error` 交回模型。
- 守卫可用性：`check-ref-format --branch` 对
  `--upload-pack=…`、`-foo`、`-c` 全部 REJECTED，对 `main`、`feature/x` ACCEPTED。

修法：argv 组装前跑同一条 `check-ref-format --branch`，不过就返回
`Invalid branch name '…'`，并把这条拒绝条件写进 git_pull 的模型可见描述。

守卫：`PullAsync_RefusesABranchArgumentThatIsAGitOption` 断言拒绝文案，并断言
`Could not read from remote repository` 这个"程序被跑过"的指纹**不在**错误里——
只有前者分不开"被拦下"与"跑失败"；
`PullAsync_StillAcceptsAnOrdinaryUpstreamPull` 保证守卫没有过宽。
改前第一条在文案断言上就是红的，实际值即 whoami 的文本。

## 刻意没做

- `git_fetch` 的模型可见描述承诺 "optionally one branch"，代码却从不读 `branch`。
  要么改描述要么改代码，这是另一个决定，不夹在安全修复里。
- 智能体 shell 可选（pwsh7/WSL 等）是另一整个工程：工具层目前没有任何设置项落地面，
  不能塞进缺陷修复。
- `AGENTS.md` 的三条约定没写进去（"给解释器分派命令要么 argv 要么原始尾，二者只留
  一个所有者"、"git 机器可读输出用 `-z`，且子进程流必须钉 UTF-8"、
  "凡是成为 git 位置参数的用户输入，先过 `check-ref-format`"）。原因不是忘了：
  根 `AGENTS.md`、`apps/desktop/AGENTS.md`、`docs/development-program/AGENTS.md`
  三个文件此刻都带着另一会话未提交的命令面板/空间编排条目，`git add` 整份文件会把
  别人的半成品一起提交。本文先作证据留档，等那份工作落地后由同一文件的干净状态补写。
- Core 的四套测试未在本批重跑；只有下面后台那次真实工具进程用例的读数。

## 下游回归

`git_status` 的路径形态与 `shell` 的 Windows 参数载体是模型可见行为，Core 经
真实 TinadecTools 子进程消费它们。检索 Core 测试后：Core 里的 `shell` 调用几乎全走
进程内假 Provider（`command = "npm run gen"` 之类，不含引号），真实工具进程用
`[RequiresTinadecTools*]` 标注，共 11 处，分布在
`ApprovalFlowTests` / `MarketCatalogApiTests` / `ToolChainEndpointTests` /
`UnattendedLaneEndToEndTests`；这些用例的文件名都是 ASCII，②对它们无影响。
本批跑的下游门是 Core Api 的
`ToolChainEndpointTests|UnattendedLaneEndToEndTests` 两组，读数见下一节。

## 下游门读数

命令：`dotnet test TinadecCore/tests/TinadecCore.Api.Tests --filter
"FullyQualifiedName~UnattendedLaneEndToEndTests|FullyQualifiedName~ToolChainEndpointTests"`
（日志 `/c/tmp/core-toolchain-3commits.log`）。

读数：**54 例总数，53 通过，1 失败**，4m39s。包装器报的退出码是管道里最后一个
命令的，不作证据；红例的名字才是证据：
`ToolChainEndpointTests.AskMode_RunsOnNarrowedRoster_BrowserWorkerCompletesWithoutSupervisor`，
`Assert.Equal()` — Expected `["skipped"]`，Actual `["pass"]`。
隔离单跑同一条**仍红**（1/1 失败），所以不是并发顺序抖动。

归属：**不是本批三刀造成的**。`git diff --stat origin/main..HEAD -- TinadecCore/` 输出为空
（本批只动 `TinadecTools/` 与 `tests/TinadecTools.Tests/`），而这条断言读的是
`/api/v1/runs/{id}/orchestration` 的 `supervision_findings[].decision`，纯 Core 侧；
该用例是普通 `[Fact]`（进程内假 Provider），根本不碰工具子进程。

已实测的事实：该投影的 `decision` 取自 `supervision.requested`/`supervision.completed`
两种**事件负载**（`DmaeaEndpoints.cs:445-453`），而引擎在 `FullDuplexRunEngine.cs:4201`
把无监督模式的 durable 终值写成 `"skipped"`、`:4222` 才把同一个值写进
`supervision.completed` 负载。因此拿到 `pass` 只有两种机制候选，**都还没被验证**：
① `supervisionSkipped` 本次为假（冻结名册里现在解析出了 supervisor）；
② `:4615` 那条交互路径无条件写 `checkpoint.SupervisionDecision = "pass"`，
在同一个 run 的后续回合覆盖了终值。测试里第 61 行那条
`supervision.skipped` 断言排在失败断言之后，从未执行，所以现场读数分辨不了这两条。

后果（为什么这条值得单独处理）：这正是 2026-09-18/10-01 那批"没人评审就不许写
pass"想关掉的那类说谎——修在了 checkpoint，而客户端与审批证据读的是投影。
按用户先前定的工作方式，这条**不夹带**进本批三刀，作为下一个待决项报出。

Gateway 与 Desktop 未重跑：本批没有改任何 HTTP 契约、wire 字段名或界面。
`previous_path` 这个 Desktop 已经在读的字段形态未变，只是值从八进制变成了真实文件名。
