# Storage/configuration 代理契约

Gateway 不创建业务存储目录、不维护数据库、不安装 MCP/Skills、不解析或保存业务 TOML。storageRoutes.ts 原样透传 Core 状态、字节、content-type、ETag 和 ProblemDetails。

提供 scopes list/open、diagnostics、stats、cleanup-preview/cleanup、configure、write-policy、close、export 和 configuration documents read/validate/save。HTTP/SSE/流式代理保留 X-Tinadec-Storage-Id；CAS 保留 If-Match。清理 preview token 与写策略的有效性由 Core 判断。

X-Tinadec-Host-Control 作为不透明宿主凭据透传，包括普通 JSON、字节流及带 cursor 的 SSE；Gateway 不生成凭据或推断授权。renderer 不接触 token：可信 Electron main 的网络层仅向已验证的127.0.0.1受管端点为登记窗口的主 frame 签发，localhost/IPv6别名不继承凭据；固定维护 IPC 的 Node 请求显式附头。

JSON/raw/SSE/cursor/stream 到 Core 的 fetch 均使用 manual redirect，保留上游重定向状态而不自动把私有自定义头发送给 Location 地址。主进程维护请求使用 error redirect；浏览器网络层对重定向后的目的地重新校验并剥除凭据。

scope-enabled Core 的全部 /api/v1 路由要求可信宿主凭据，包括读取/预览、审批、purge、open/close/export/migrate 和普通写；公开 GET health 只提供最小指纹，GET host-challenge 只提供 nonce/角色绑定的证明。Gateway 不因 loopback、本地模式或自身启动环境中的 token 自动授予。Agent shell 与未绑定可信宿主的 Web/远程客户端不能访问这些 API，Core 返回403 host_authorization_required；不能宣称匿名远程读取仍兼容。OpenAPI 使用私有宿主 security scheme，两个公开探针单独取消全局 security requirement。

Gateway 自身公开 `GET /api/v1/host-challenge?nonce=...` 要求恰好一个43字符 base64url nonce，返回 `{role:'gateway',nonce,proof}`；proof 是 UTF8 私有 token 对 `tinadec-host-v1\0gateway\0<nonce>` 的 HMAC-SHA256 小写hex。不给 Gateway key 返回503 host_identity_unavailable；不回显 key、不代理到 Core、不发业务事实、Cache-Control:no-store。Electron 在向该端点发送任何私有头前先验证 proof，不能以公共健康指纹信任伪服务；此证明不等于对普通匿名 API 签发授权。

Project/Session 聚合 mapper 保留可选 storage_id。CORS 保留 origin 限制，允许 storage header 并暴露 ETag、request id、下载文件名。OpenAPI 使用 detail 元数据描述响应，不对上游加 runtime response 验证。snapshot 与 Desktop schema 一起再生。

验证：`bun test src/storageProxy.test.ts src/toolsSettingsProxy.test.ts src/runtimeProxy.test.ts src/coreClient.test.ts`。
## 维护与迁移增量

content-preview/content-collect 与 storage-delete-preview/storage-delete 独立代理；整个存储删除不等于 DELETE scopes 的取消登记。close/unregister 保留 Core 204；close 等待既有租约释放，并透传取消信号，维护冲突或重复关闭返回409；export 保留 application/zip 与 Content-Disposition。异步 sessions/migrate 返回202 receipt，session-transfers查询经 user 宿主；target_storage_id显式路由。OpenAPI具体 request schema、StorageScope身份和204/ZIP响应与Core契约一致。
