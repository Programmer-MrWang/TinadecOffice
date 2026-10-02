# TinadecOffice 渠道发布契约

本文定义 TinadecOffice 完整安装包、运行时模块包和 AgentPack 包之间的发布边界。契约的目标是让 GitHub Release 产物可以被 Tinadec Manager 按清单消费，同时保留普通用户直接使用 NSIS 安装器的一键安装路径。

## 交付类型

同一个 `vX.Y.Z` Release 可以包含以下三类制品：

- `full-installer`：`TinadecOffice-X.Y.Z-win-x64-setup.exe` 和 portable 包。它是完整工作台，内部携带 Core、Gateway、Tools、PortableGit 和 native 工具，面向直接安装的普通用户。
- `runtime-module`：面向 Manager 的 Windows x64 ZIP。当前组件为 `tools`、`core`、`gateway`。ZIP 根目录就是组件安装根，根目录必须包含 `tinadec-package.json`。
- `agent-pack`：面向 Core 工作区的 AgentPack ZIP。它包含 `manifest.json`、`envelope.json` 和 `tinadec-package.json`，不能作为进程或普通运行时目录启动。

运行时模块的依赖顺序是 `tools → core → gateway`。Core 通过 Manager 生成的机器级注册文件找到 Tools，Gateway 通过 Core 的本地健康端点工作。一个模块更新失败时，旧的 `active.json` 指针保持不变。

## ZIP 根目录元数据

运行时模块和 AgentPack 的 `tinadec-package.json` 使用以下字段：

```json
{
  "schemaVersion": 1,
  "kind": "runtime-module",
  "productLine": "office",
  "productId": "tinadec-office-core",
  "component": "core",
  "releaseVersion": "0.1.0",
  "packageVersion": "0.1.0",
  "platform": "windows",
  "architecture": "x64",
  "entrypoint": "TinadecCore.Api.exe",
  "expectedFiles": ["TinadecCore.Api.exe", "appsettings.json"]
}
```

`agent-pack` 使用 `agentPack` 子对象描述 Core 交接信息：

```json
{
  "schemaVersion": 1,
  "kind": "agent-pack",
  "productLine": "office",
  "productId": "tinadec-office-agentpack",
  "component": "agentpack",
  "releaseVersion": "0.1.0",
  "packageVersion": "3.0.1",
  "platform": "windows",
  "architecture": "x64",
  "agentPack": {
    "packId": "tinadec.graph.seed-pack",
    "digest": "<64 lowercase hex characters>",
    "minimumCoreVersion": "0.1.0",
    "manifestPath": "manifest.json",
    "envelopePath": "envelope.json"
  }
}
```

`packageVersion` 是组件自身版本，`releaseVersion` 是外层 Office Release 版本。两者都必须进入元数据，CI 不允许依靠文件名猜测版本。当前 AgentPack 可以独立于桌面程序演进，但每个 Release 都必须记录它实际携带的 pack 版本和 digest。

## Catalog manifest

Manager 消费 `catalog.json`。顶层仍使用 `schemaVersion: 1`，旧的 core/gateway/tools/app 产品条目继续有效；Office 条目额外填写：

- `productLine: "office"`
- `packageKind: "runtime-module" | "agent-pack" | "full-installer"`
- `runtimeRole: "tools" | "core" | "gateway"`（仅运行时模块）
- release 的 `packageMetadata`，其内容必须与 ZIP 根目录元数据一致
- `dependencies` 中的 SemVer 范围和 `optional` 标记

运行时制品的 artifact 同时记录平台、架构、格式、URL、字节数和 SHA-256。Manager 先校验清单，再下载制品；下载后先校验字节数和 SHA-256，再检查 ZIP 内元数据、必需文件和路径安全，最后才激活版本。catalog、Release 资产和 `SHA256SUMS` 在同一个 GitHub Release 中生成。

## Manager 与 Office 的交接

Manager 只负责机器级运行时和 Pack 的获取、完整性校验、版本指针及注册信息：

- 运行时模块安装到 `%LOCALAPPDATA%\\Tinadec\\apps\\<productId>\\versions\\<version>`，并在 `%LOCALAPPDATA%\\Tinadec\\apps\\office-runtime.json` 写入 Core、Gateway、Tools 的活动路径、版本、channel、artifact digest。
- AgentPack 安装到同一 Manager 安装根下的版本目录，注册文件只记录 manifest/envelope 的受控路径、pack id、版本和 digest。
- TinadecOffice 启动时读取并校验该注册文件；存在完整模块注册时使用 Manager 的模块路径，否则使用 NSIS 内置 runtime。Office 将注册的 AgentPack envelope 交给 Core 的 `install-preview` / `install` API，仍遵守 owner 确认、ETag/revision、幂等键和 Core workspace 权限。

注册文件是机器级交接缓存，不是 Core 数据库，也不是工作区 Pack 的安装结果。SHA-256 只保证传输完整性；发布者身份、签名、公钥轮换属于后续信任链阶段。

## CI 门禁

Windows x64 构建从同一份 `apps/desktop/runtime` 生成 NSIS、portable 和三个运行时 ZIP，避免二次编译漂移。校验脚本必须确认：

1. 每个 ZIP 的 `tinadec-package.json` 字段与当前 Release、组件、Windows x64 一致。
2. ZIP 没有绝对路径或 `..` 越界条目，并包含组件入口和配置文件。
3. Core、Gateway、Tools 入口是 x64 PE；Tools ZIP 同时带 PortableGit 和 native ripgrep。
4. AgentPack envelope 的 digest 等于 manifest 的 RFC 8785 canonical JSON SHA-256。
5. `catalog.json` 中的大小、SHA-256、URL 和包元数据与实际 Release 资产一致。

非 tag 构建可以生成临时 ZIP 和 catalog 作为 CI 工件，但只有 tag 构建发布 GitHub Release。