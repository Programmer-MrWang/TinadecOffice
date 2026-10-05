# Gateway 长连接稳定性复查（2026-10-05）

## 结论

这次崩溃不是 Core 返回 5xx，也不是前端把错误状态写错。Gateway 在长连接代理上漏掉了入站断开信号：`/runs/{runId}/stream`、`/events` 和日志/附件流把 Core 的 `Response.body` 直接交给客户端，却没有把 `request.signal` 传给上游 `fetch`。客户端离开页面、切换会话或停止流之后，上游流继续存活，连接和 abort 资源逐步累积。Windows Bun 1.3.14 的 HTTP/ReadableStream abort 路径又存在原生崩溃缺陷，两者叠加解释了之前多个实例相同的 `Internal assertion failure`。

官方 Bun issue [#32111](https://github.com/oven-sh/bun/issues/32111) 给出了 1.3.14 中“异步 ReadableStream + 客户端中断”触发原生崩溃的最小复现；[#32585](https://github.com/oven-sh/bun/issues/32585) 记录了 Windows 1.3.14 长时间运行本地 HTTP proxy 后崩溃。它们与本机日志的版本、平台、`abort_signal` 特征和 long lived localhost proxy 形状一致。这里的“Bun 缺陷”是外部证据支持的判断；项目代码缺少取消传播是本仓库独立确认的缺陷。

## 代码修复

- `ProxyOptions`、`StreamProxyOptions` 支持 `AbortSignal`，所有底层 Core/Tool Runtime `fetch` 都继续携带它。
- run SSE、session events SSE、附件上传/下载、session logs 和 logs stream 都把 Elysia 的 `request.signal` 传入代理层。
- TinaChat 和 organization 的透明代理也传递信号，避免客户端取消后普通上游请求继续占用连接。
- `runtimeProxy.test.ts` 增加回归用例，确认 run SSE 将入站 signal 原样交给 Core。

没有改响应体为自建异步 `ReadableStream`。官方复现表明该形态本身会扩大 Bun 的 `onAbort` 竞态；仍透传原始响应体，只补齐生命周期信号。

## 证据

隔离的 Node Core 模拟器 + 当前 Gateway 源码测试：

| 测试 | 修复前 | 修复后 |
|---|---:|---:|
| 客户端中断 run SSE 200 次 | Core 关闭 0/200，Gateway 未退出 | Core 关闭 200/200，Gateway 未退出 |
| 客户端中断 run/events 流 1000 次 | 未跑 | Gateway 未退出，Core 连接全部回收 |
| Gateway Bun 测试 | 76/76（基线） | **77/77** |
| 无压缩 Windows Bun 构建检查 | — | `bun build --target=bun` 成功，372 modules |

真实 Core + 克隆的已配置模型数据库 + 当前 Gateway 全链路也跑通：启动期短暂 503（Core 迁移尚未完成）后健康 200；项目列表和会话读取成功；真实交互 admission 返回 201；run SSE 首帧返回；随后 100 次 events SSE 中断全部完成，Gateway 未退出。记录在 `C:/tmp/tinadec-gateway-e2e-20261005/result.json`，敏感 provider 配置没有写入仓库。

修复后的隔离探针仍会为每次预期的客户端取消打印 Bun `AbortError`，这是正常的断开噪声；后续应在升级 Bun 或确认其 abort 日志接口后再处理日志降噪，不能用全局吞异常掩盖真正的上游错误。

## 未闭合边界

- 这次修复降低并验证了连接泄漏和崩溃触发面，但没有证明 Bun 1.3.14 的所有 HTTP/WebSocket/ReadableStream 原生崩溃都消失。
- 仍建议发布和开发环境固定经过验证的 Bun 版本，并在 Windows CI 加入真实客户端中断的长连接压力门禁。
- 历史四个真实用户实例的崩溃日志保留在 eval session；修复后的 1000 次隔离和一次真实 Core 链路没有再退出，不能把它改写成历史实例已经自动恢复。
