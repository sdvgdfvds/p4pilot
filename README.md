<div align="center">

# 🧭 p4pilot

### The Perforce-native layer for AI coding agents.

**Auto-checkout · changelist-aware edits · binary-asset guarding · depot code review — over [MCP](https://modelcontextprotocol.io).**

Works with **Claude Code**, **Cursor**, and **Codex** — no Git required.

[![CI](https://github.com/sdvgdfvds/p4pilot/actions/workflows/ci.yml/badge.svg)](https://github.com/sdvgdfvds/p4pilot/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests-81%20passing-brightgreen)](#see-it-in-action)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![MCP](https://img.shields.io/badge/protocol-MCP-blueviolet)](https://modelcontextprotocol.io)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-3c873a)](https://nodejs.org)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://sdvgdfvds.github.io/p4pilot/)

</div>

---

> **✅ Status: MVP + Phase 2 demo live.** Core + MCP server are done and fully
> tested — 81 tests, green in CI, and runnable today with zero Perforce via
> `--mock`. The Phase 2 in-browser demo (changelist dashboard + review UI) is
> now live.
>
> **▶ Live demo (no install):** https://sdvgdfvds.github.io/p4pilot/

## See it in action

<p align="center">
  <a href="https://sdvgdfvds.github.io/p4pilot/">
    <picture>
      <source media="(max-width: 700px)" srcset="./docs/assets/demo-dashboard-mobile.png">
      <img src="./docs/assets/demo-dashboard.png" alt="p4pilot workspace dashboard showing guarded assets and pending changelists">
    </picture>
  </a>
</p>

The agent is about to edit two files. p4pilot checks them out first — into the
right changelist — and flags the binary asset **before** it's touched:

```text
$ p4_changelist_create { "description": "player dash tuning" }
Created pending changelist 813: [p4pilot] player dash tuning

$ p4_smart_edit { "paths": ["/depot/game/src/main.cpp", "/depot/game/Content/Hero.uasset"], "changelist": "813" }
Ensured 2 path(s) open for edit:
opened	/depot/game/src/main.cpp [cl 813]
opened	/depot/game/Content/Hero.uasset [cl 813]  ⚠ large-asset — edit carefully (large-asset extension .uasset)

$ p4_status {}
2 open file(s):
edit	//depot/game/src/main.cpp (change 813)
edit	//depot/game/Content/Hero.uasset (change 813)
```

Real output from `npx @p4pilot/mcp-server --mock` — no Perforce required. All 12
tools are documented in [`docs/TOOLS.md`](./docs/TOOLS.md).

## Why this exists

Every mainstream AI coding agent — Claude Code, Cursor, Codex, Copilot — is
built for **Git**. It assumes Git primitives: file writes are free, diffs come
from `git diff`, "commit gates" run on hooks, and the repo is mostly text.

**Game studios don't work like that.** They run on **Perforce (P4)**, where:

- A file must be **`p4 edit`-ed (checked out) before you can modify it.** An
  agent that just writes to disk produces changes Perforce can't even see.
- Repos are **huge and full of binary assets** (`.uasset`, `.umap`, `.fbx`,
  `.psd`, `.wav`). These break the file-traversal and indexing heuristics
  agents rely on.
- Work is organized around **changelists**, not commits.

This is a documented, real gap. Anthropic's own large-codebase guidance notes
that native Perforce support only arrived **after a customer built a hook that
intercepted file writes to enforce `p4 edit`.** Until you build that bridge,
"some defaults will not fire."

**p4pilot is that bridge — as a reusable, open-source MCP server.**

## What it does

| Capability                       | What it means for the agent                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔓 **Smart auto-checkout**       | Before the agent edits a file, p4pilot ensures it's `p4 edit`-ed (or `p4 add`-ed if new) into the right changelist. The exact hook studios hand-roll — built in.                              |
| 🗂️ **Changelist-aware planning** | The agent groups its work into pending changelists with generated descriptions, instead of dumping everything into `default`.                                                                 |
| 🛡️ **Binary-asset guard**        | `.uasset`/`.fbx`/`.psd` and other large binaries are detected and returned as **metadata** (type, size, last change, who touched it) instead of choking the context window with binary bytes. |
| 🔎 **Depot code search**         | Fast text search over the synced workspace that automatically skips binary assets.                                                                                                            |
| 👀 **Changelist code review**    | Turn a pending or shelved changelist into a structured, review-ready diff — "PR review" for Perforce.                                                                                         |
| 🧾 **History & blame**           | `filelog`/`describe`-backed history so the agent can answer "who changed this and why".                                                                                                       |

All exposed as **MCP tools**, so any MCP client (Claude Code, Cursor, Codex,
JetBrains, …) gets Perforce fluency with zero custom glue. See the full
[tool reference](./docs/TOOLS.md).

### Human-controlled submission

p4pilot deliberately stops at prepared, reviewable changelists. It does not
expose `p4 submit`: a human reviews the diff and submits through their normal
Perforce workflow. This is a product safety boundary, not a missing tool.

## How it compares

|                                   | git-only agents | raw `p4` MCP wrappers | **p4pilot** |
| --------------------------------- | :-------------: | :-------------------: | :---------: |
| Works on a Perforce depot         |       ❌        |          ✅           |     ✅      |
| **Auto-checkout before edit**     |       ❌        |          ❌           |     ✅      |
| Binary-asset guarding             |       ❌        |          ❌           |     ✅      |
| Changelist-aware task planning    |       ❌        |          ❌           |     ✅      |
| Changelist code review            |     partial     |          ❌           |     ✅      |
| Zero-setup mock mode for demos/CI |        —        |        rarely         |     ✅      |

## Quickstart

> Requires Node.js ≥ 20. A real Perforce connection uses your existing
> `P4PORT`/`P4CLIENT`/`P4USER` (or `.p4config`). No Perforce? Use **mock mode**
> below to try everything with an in-memory fake depot.

### Try it with a fake depot (no Perforce needed)

```bash
npx @p4pilot/mcp-server --mock
```

### Claude Code

```bash
claude mcp add p4pilot -- npx -y @p4pilot/mcp-server
```

### Cursor / other MCP clients (`mcp.json`)

```jsonc
{
  "mcpServers": {
    "p4pilot": {
      "command": "npx",
      "args": ["-y", "@p4pilot/mcp-server"],
      "env": {
        "P4PORT": "ssl:perforce.example.com:1666",
        "P4CLIENT": "my-workspace",
      },
    },
  },
}
```

### Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.p4pilot]
command = "npx"
args = ["-y", "@p4pilot/mcp-server"]
```

### Run from source

```bash
git clone https://github.com/sdvgdfvds/p4pilot.git
cd p4pilot
npm install && npm run build
node packages/mcp-server/dist/index.js --mock   # or wire the built binary into your MCP client
```

Ready-to-copy config snippets for each client live in
[`examples/`](./examples).

## Architecture

```
┌──────────────────────────────────────────────┐
│  AI coding agent (Claude Code / Cursor / Codex)│
└───────────────────────┬────────────────────────┘
                         │  MCP (stdio)
                ┌────────▼─────────┐
                │ @p4pilot/mcp-server │   tools: p4_smart_edit, p4_status,
                │  (zod-typed tools)  │   p4_review, p4_asset_info, p4_search …
                └────────┬─────────┘
                         │  typed calls
                ┌────────▼─────────┐
                │   @p4pilot/core   │   auto-checkout · asset-guard ·
                │                   │   changelist planning · config
                └────────┬─────────┘
                         │  P4Runner interface
              ┌──────────┴───────────┐
        ┌─────▼──────┐         ┌──────▼───────┐
        │ ExecaP4Runner│        │ MockP4Runner │  (tests / --mock demo)
        │  real `p4`   │        │  fake depot  │
        └──────────────┘        └──────────────┘
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and
[`docs/SPEC.md`](./docs/SPEC.md) for the design, [`docs/TOOLS.md`](./docs/TOOLS.md)
for the tool reference, and [`docs/PLAN.md`](./docs/PLAN.md) for the build plan.

## Roadmap

- [x] **MVP:** core (runner/parser/client/auto-checkout/asset-guard) + MCP server
- [x] Polish: examples, CI, tool reference & architecture docs
- [x] **Phase 2:** React demo panel (changelist dashboard + review UI), live in-browser on GitHub Pages
- [x] Human-owned submit boundary: p4pilot prepares and reviews; a person submits
- [ ] Embed the review panel in PC client / **UE / Maya** WebViews
- [ ] Shelved-changelist review workflow
- [ ] Asset dependency surfacing (UE `.uasset` references)

## Contributing

This project is built test-first. See [`AGENTS.md`](./AGENTS.md) for the
execution contract, [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the
design, and [`docs/PLAN.md`](./docs/PLAN.md) for open tasks. PRs welcome.

## License

[MIT](./LICENSE) © p4pilot contributors
