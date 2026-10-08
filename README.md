<p align="center">
  <img src="docs/images/poster.webp" alt="TinadecOffice — 当 Agent 开始协同工作 · Agent Teamwork" width="100%" />
</p>

<h1 align="center">TinadecOffice</h1>

<p align="center">
  <b>An AI-agent workbench built on a strict frontend/backend split and a dual-layer agent runtime.</b><br/>
  一款基于严格前后端分离与双层智能体运行时（DmaEA）的 AI 智能体工作台。
</p>

<p align="center">
  <a href="README.md"><img alt="English" src="https://img.shields.io/badge/English-current-2ea44f"></a>
  <a href="README.zh-CN.md"><img alt="中文" src="https://img.shields.io/badge/简体中文-README.zh--CN.md-d9d9d9"></a>
</p>

<p align="center">
  <a href="https://github.com/Tinadec/TinadecOffice/releases"><img alt="Release" src="https://img.shields.io/github/v/release/Tinadec/TinadecOffice?include_prereleases&logo=github&color=4c1"></a>
  <a href="#license"><img alt="License" src="https://img.shields.io/badge/License-GPL--3.0%20%2B%20MIT%20%2B%20AGPL--3.0-blue"></a>
  <img alt=".NET" src="https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet">
  <img alt="Vue" src="https://img.shields.io/badge/Vue-3.6-4FC08D?logo=vuedotjs&logoColor=white">
  <img alt="Gateway" src="https://img.shields.io/badge/Gateway-Elysia%20%2B%20Bun-000000?logo=bun&logoColor=white">
  <img alt="Platforms" src="https://img.shields.io/badge/Platforms-Windows%20%C2%B7%20Linux%20%C2%B7%20macOS-2ea44f">
</p>

<p align="center">
  <a href="https://github.com/Tinadec/TinadecOffice/commits"><img alt="Commits last month" src="https://img.shields.io/github/commit-activity/m/Tinadec/TinadecOffice?labelColor=32b583&color=12b76a"></a>
  <a href="https://github.com/Tinadec/TinadecOffice/commits"><img alt="Last commit" src="https://img.shields.io/github/last-commit/Tinadec/TinadecOffice"></a>
  <a href="https://github.com/Tinadec/TinadecOffice/graphs/contributors"><img alt="Contributors" src="https://img.shields.io/github/contributors/Tinadec/TinadecOffice"></a>
</p>

<p align="center">
  <a href="https://discord.gg/EcKYQfbG72"><img alt="Discord" src="https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?logo=discord&logoColor=white"></a>
  <a href="#community"><img alt="QQ Group" src="https://img.shields.io/badge/QQ%20Group-370780878-EB1923?logo=tencentqq&logoColor=white"></a>
  <a href="https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=7a3k9813-07f8-4e13-b00c-d9d1c07d539b"><img alt="Feishu" src="https://img.shields.io/badge/Feishu-Join%20the%20group-3370FF?logo=feishu&logoColor=white"></a>
  <a href="https://x.com/tinadecoffice"><img alt="X (Twitter)" src="https://img.shields.io/badge/X-%40tinadecoffice-000000?logo=x&logoColor=white"></a>
</p>

---

## What is TinadecOffice?

TinadecOffice is a **product family for multi-agent collaboration**: every piece — the desktop app, the stateless gateway, the governance runtime, and the governed tool host — ships and can be replaced **independently**. The frontend never holds business state; the backend never knows about pixels. All authority over permissions, approvals, checkpoints, and tool side effects lives in exactly one place: **TinadecCore**.

**v0.2.0 is live** — signed installers for Windows, Linux and macOS. All public HTTP / OpenAPI / SSE / WebSocket contracts are permanently fixed at `/api/v1`: no v2, no legacy aliases, ever.

**What it can do**

- **Orchestrate agent teams, not one chatbot** — a governance layer plans, dispatches and reviews; an execution layer of scoped workers delivers evidence. You approve, reject, delegate, pause, resume or cancel at any point.
- **Keep every mutation behind a gate** — every write (file, shell, git) waits at an approval gate; each run freezes its tool manifest and configuration, hash-pinned and immutable.
- **Plug in tools and outside worlds** — governed file / shell / git tools plus MCP passthrough, all behind one tool-provider contract.
- **Drive models your way** — a model & agent center with routes, providers, per-agent policies and immutable version publishing.
- **Work in a real workbench** — detachable panel windows, an agent terminal, run timelines, and an agent-to-agent chat channel.

## Architecture

### Frontend and backend, strictly separated

The UI only ever sees the gateway. Business state lives in Core alone. The tool layer is the only thing that touches the outside world — and it reports state back up the same wires.

<p align="center">
  <img src="docs/diagrams/out/boundary.svg" alt="Frontend/backend separation: UI, gateway, core, tool layer and the outside world" />
</p>

### One runtime, two layers of agents

DmaEA (Dual-layer Modular Agent Architecture) separates **the agents that govern the team** from **the agents that do the work** — that separation is the team-orchestration capability:

<p align="center">
  <img src="docs/diagrams/out/dual-layer.svg" alt="Dual-layer DmaEA: the operation layer orchestrates the execution layer, with an approval gate on every write" />
</p>

- The operation layer **governs instead of executing** — it plans, dispatches and reviews. It may *declare* tools, but the calls only ever run through Core's dispatcher; nothing executes in a governance agent's own hands.
- Tool access is never implicit: it comes from an explicit pack `tool_scope` and an explicit write grant, and every mutation still passes the **approval gate** — human or delegated.
- Every worker's tool surface = its instance grant ∩ the **run-frozen tool manifest** (hash-pinned, immutable).
- Runs are durable: pause, resume, cancel — and recover across restarts.

## Where we are

<p align="center">
  <img src="docs/diagrams/out/roadmap.svg" alt="Roadmap: shipped, building now, and next up" />
</p>

## Quick start

```powershell
npm install
npm run restore:dotnet
npm run dev
```

| Service | Address |
|---------|---------|
| Desktop (Vite) | http://127.0.0.1:5173 |
| Gateway API / Docs | http://127.0.0.1:48730/docs |
| Core | http://127.0.0.1:48731 |

For startup details and troubleshooting see [docs/startup.md](docs/startup.md).

<details>
<summary><b>Development commands</b></summary>

```bash
npm run dev              # Core + Gateway + Desktop together
npm run dev:core         # Core only (48731)
npm run dev:gateway      # Gateway only (48730)
npm run dev:desktop      # Desktop only (5173)
npm run build            # workspaces + .NET solution
npm test                 # tests
```

Core-only build:

```powershell
Remove-Item Env:Version -ErrorAction SilentlyContinue
dotnet restore TinadecCore/TinadecCore.slnx
dotnet build TinadecCore/TinadecCore.slnx --no-restore
dotnet test TinadecCore/TinadecCore.slnx --no-build
```

</details>

## Repository layout

```
TinadecOffice/
├── TinadecCore/              # MAF + DmaEA agent-governance runtime (.NET 10)
├── TinadecGateway/           # optional Elysia API facade / protocol adapter
├── apps/                     # TinadecApp clients (desktop / web / TinadecUI)
├── TinadecTools/             # TinadecTool: governed file / shell / git / MCP tools
├── TinadecTools.Generators/  # [ToolFunction] static-registry source generator
├── tests/                    # tools tests + legacy Core / contract evidence tests
├── docs/                     # product model, architecture, security, startup guides
└── TinadecOffice.slnx        # root solution
```

## Documentation

| Document | Purpose |
|----------|---------|
| [Core product definition & DmaEA baseline](docs/tinadec-core-product-definition.zh-CN.md) | Authoritative: positioning, DmaEA, permissions, evolution, roadmap |
| [Harness integration model](docs/agent-harness-product-model.zh-CN.md) | Integration/deployment responsibilities ([English](docs/agent-harness-product-model.en.md)) |
| [Architecture](docs/architecture.md) | Technical architecture, ports, event shapes |
| [Startup guide](docs/startup.md) | Local startup & troubleshooting |
| [Security](docs/security.md) | Security boundaries and constraints |
| [Core packaging & standalone deployment](docs/tinadec-core-packaging.zh-CN.md) | NuGet packages, API publish directory, delivery boundary |

## Community

- **Discord** — [discord.gg/EcKYQfbG72](https://discord.gg/EcKYQfbG72)
- **QQ Group** — `370780878`
- **Feishu Group** — [join via link](https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=7a3k9813-07f8-4e13-b00c-d9d1c07d539b)
- **X (Twitter)** — [@tinadecoffice](https://x.com/tinadecoffice)

## Contributors

<a href="https://github.com/Tinadec/TinadecOffice/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tinadec/TinadecOffice&anon=1" alt="Contributors" />
</a>

Also building with us — **Wang Haoyu**: docs-vs-code realignment, environment & If-Match fixes, UI rework, and the theme page (PRs #22–#25, landed on main in the #27 squash merge).

## Star history

<a href="https://star-history.com/#Tinadec/TinadecOffice&Date">
  <img src="https://api.star-history.com/svg?repos=Tinadec/TinadecOffice&type=Date" alt="Star History Chart" />
</a>

## License

Copyright (c) 2026 Lincube

| Scope | License | Location |
|-------|---------|----------|
| TinadecOffice overall (incl. `apps/desktop`, `apps/web`, `apps/TinadecUI`, `docs`, `scripts`) | `GPL-3.0-or-later` | [`LICENSE`](LICENSE) |
| `TinadecCore` (all modules under `TinadecCore/` + NuGet packages `TinadecCore.Contracts`/`Abstractions`/`Runtime`) | `MIT` | [`TinadecCore/LICENSE`](TinadecCore/LICENSE) |
| `TinadecGateway` | `AGPL-3.0-or-later` | [`TinadecGateway/LICENSE`](TinadecGateway/LICENSE) |
| `TinadecTools` (incl. `TinadecTools.Generators`) | `AGPL-3.0-or-later` | [`TinadecTools/LICENSE`](TinadecTools/LICENSE) |

Third-party attributions live in [`NOTICE`](NOTICE). Combined distribution must satisfy the strictest component's obligations (AGPL-3.0 §13 network-service clause for Gateway/Tools).
