<!--
╔══════════════════════════════════════════════════════════════════╗
║                    BANNER SPACE RESERVED                         ║
║        Cover art / product screenshot — coming soon.             ║
╚══════════════════════════════════════════════════════════════════╝
-->

<p align="center">
  <img src="apps/desktop/public/Logo - 白.png" alt="Tinadec" width="120" />
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
</p>

---

## What is TinadecOffice?

TinadecOffice is a **product family for multi-agent collaboration**: every piece — the desktop app, the stateless gateway, the governance runtime, and the governed tool host — ships and can be replaced **independently**. The frontend never holds business state; the backend never knows about pixels. All authority over permissions, approvals, checkpoints, and tool side effects lives in exactly one place: **TinadecCore**.

**v0.2.0 is live** — signed installers for Windows, Linux and macOS. All public HTTP / OpenAPI / SSE / WebSocket contracts are permanently fixed at `/api/v1`: no v2, no legacy aliases, ever.

```mermaid
mindmap
  root((TinadecOffice))
    Dual-layer agents · DmaEA
      Operation layer
        coordinate · plan · supervise
        zero tool access
      Execution layer
        workers spawned per task
        deliver evidence, not vibes
    Governed tools
      approval-gated writes
      per-run frozen manifest
      MCP passthrough
    Human in the loop
      approve · reject · delegate
      pause / resume / cancel runs
      restart-safe checkpoints
    Desktop workbench
      Electron + Vue 3.6
      detachable panel windows
      agent terminal & chat
    Model & Agent center
      routes · providers · versions
      immutable mode publishing
```

## Architecture

### The boundary that never moves

The desktop app **never** talks to Core directly. The gateway is a **permanent, stateless facade** — identity, protocol adaptation, and stream forwarding only. No second copy of business state exists anywhere but Core.

```mermaid
flowchart LR
    subgraph FE["Frontend — TinadecApp"]
        D[Desktop<br/>Electron · Vue 3.6]
        W[Web]
    end

    subgraph EDGE["Boundary"]
        G[TinadecGateway · :48730<br/>stateless facade<br/>identity · protocol · SSE relay]
    end

    subgraph BE["Backend — TinadecCore · :48731"]
        C[Single authority<br/>DmaEA · permissions · approvals<br/>checkpoints · audit · evolution]
        T[TinadecTool<br/>governed tool host<br/>files · shell · git · MCP]
    end

    D -- "HTTP / SSE / WebSocket" --> G
    W -- "HTTP / SSE" --> G
    G -- "pure proxy" --> C
    C -- "tool provider contract" --> T
    C -- "same contract" --> O[other tool providers]
    C --- DB[(SQLite default<br/>PostgreSQL optional)]
```

### One runtime, two layers of agents

DmaEA (Dual-layer Modular Agent Architecture) separates **the agents that govern** from **the agents that do**:

```mermaid
flowchart TB
    subgraph OP["Operation layer — governance · zero tool access"]
        MTG[Meeting<br/>entry · context · final answer]
        PLN[Planner<br/>task graph]
        SUP[Supervisor<br/>verdicts · escalation]
    end

    subgraph EX["Execution layer — workers · scoped & spawned on demand"]
        WK1[Worker · code]
        WK2[Worker · search]
        WK3[Worker · data …]
    end

    MTG --> PLN --> WK1 & WK2 & WK3
    WK1 & WK2 & WK3 -->|evidence| SUP
    SUP -->|verdict| MTG

    GATE{{Approval gate<br/>every write tool call}}
    WK1 -. write_file · shell · git_* .-> GATE
    GATE -. human or delegated reviewer .-> WK1

    MTG & PLN & SUP & WK1 --- CP[(durable checkpoints<br/>pause · resume · restart recovery)]
```

- The operation layer **cannot invoke any tool** — enforced as permission data, not as a convention.
- Every worker's tool surface = its instance grant ∩ the **run-frozen tool manifest** (hash-pinned, immutable).
- Tool calls that mutate anything wait at an **approval gate**: a human click, a delegated reviewer gate, or a pre-authorized lease — always auditable.

## Where we are

```mermaid
gantt
    dateFormat YYYY-MM-DD
    axisFormat %Y-%m

    section Shipped
    DmaEA dual-layer runtime & durable runs     :done,      r1, 2026-03-01, 2026-08-15
    Permissions · approvals · checkpoint closure :done,     r2, 2026-08-15, 2026-09-10
    Graph orchestration (3 tiers)                :done,     r3, 2026-09-12, 2026-09-30
    Desktop workbench (Electron + Vue)           :done,     r4, 2026-05-01, 2026-09-24
    v0.2.0 — 3-platform installers               :milestone, r5, 2026-10-04, 0d

    section Building now
    TUI channel & host PTY backend               :active,   r6, 2026-09-25, 2026-11-30
    Cross-platform polish (Linux/macOS)          :active,   r7, 2026-10-01, 2026-12-15

    section Next up
    In-app updater                               :          r8, 2026-11-15, 2026-12-31
    Git governance & auto-evolution              :          r9, 2026-12-01, 2027-02-15
    Stable client SDK · CLI · container release  :          r10, 2027-01-01, 2027-03-31
```

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
| [Core reference decisions](docs/tinadec-core-reference-decisions.zh-CN.md) | MAF + nine reference projects: evidence, adoptions, rejections |
| [Harness integration model](docs/agent-harness-product-model.zh-CN.md) | Integration/deployment responsibilities ([English](docs/agent-harness-product-model.en.md)) |
| [Architecture](docs/architecture.md) | Technical architecture, ports, event shapes |
| [Startup guide](docs/startup.md) | Local startup & troubleshooting |
| [Security](docs/security.md) | Security boundaries and constraints |
| [Core packaging & standalone deployment](docs/tinadec-core-packaging.zh-CN.md) | NuGet packages, API publish directory, delivery boundary |

## Community

- **Discord** — [discord.gg/EcKYQfbG72](https://discord.gg/EcKYQfbG72)
- **QQ Group** — `370780878`
- **Feishu Group** — [join via link](https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=7a3k9813-07f8-4e13-b00c-d9d1c07d539b)

## Contributors

<a href="https://github.com/Tinadec/TinadecOffice/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tinadec/TinadecOffice" alt="Contributors" />
</a>

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
