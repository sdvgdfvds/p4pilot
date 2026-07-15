<div align="center">

# 🧭 p4pilot

### The Perforce-native layer for AI coding agents.

**Auto-checkout · changelist-aware edits · binary-asset guarding · depot code review — over [MCP](https://modelcontextprotocol.io).**

Works with **Claude Code**, **Cursor**, and **Codex** — no Git required.

<!-- badges: wired up in the "polish" milestone -->
[![CI](https://img.shields.io/badge/CI-pending-lightgrey)](#)
[![npm](https://img.shields.io/badge/npm-@p4pilot/mcp--server-lightgrey)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![MCP](https://img.shields.io/badge/protocol-MCP-blueviolet)](https://modelcontextprotocol.io)

</div>

---

> **⚠️ Status: pre-release / under active construction.** The MVP surface is
> being built from the plan in [`docs/PLAN.md`](./docs/PLAN.md). Star & watch to
> follow along.

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

| Capability | What it means for the agent |
|---|---|
| 🔓 **Smart auto-checkout** | Before the agent edits a file, p4pilot ensures it's `p4 edit`-ed (or `p4 add`-ed if new) into the right changelist. The exact hook studios hand-roll — built in. |
| 🗂️ **Changelist-aware planning** | The agent groups its work into pending changelists with generated descriptions, instead of dumping everything into `default`. |
| 🛡️ **Binary-asset guard** | `.uasset`/`.fbx`/`.psd` and other large binaries are detected and returned as **metadata** (type, size, last change, who touched it) instead of choking the context window with binary bytes. |
| 🔎 **Depot code search** | Fast text search over the synced workspace that automatically skips binary assets. |
| 👀 **Changelist code review** | Turn a pending or shelved changelist into a structured, review-ready diff — "PR review" for Perforce. |
| 🧾 **History & blame** | `filelog`/`describe`-backed history so the agent can answer "who changed this and why". |

All exposed as **MCP tools**, so any MCP client (Claude Code, Cursor, Codex,
JetBrains, …) gets Perforce fluency with zero custom glue.

## How it compares

| | git-only agents | raw `p4` MCP wrappers | **p4pilot** |
|---|:--:|:--:|:--:|
| Works on a Perforce depot | ❌ | ✅ | ✅ |
| **Auto-checkout before edit** | ❌ | ❌ | ✅ |
| Binary-asset guarding | ❌ | ❌ | ✅ |
| Changelist-aware task planning | ❌ | ❌ | ✅ |
| Changelist code review | partial | ❌ | ✅ |
| Zero-setup mock mode for demos/CI | — | rarely | ✅ |

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
      "env": { "P4PORT": "ssl:perforce.example.com:1666", "P4CLIENT": "my-workspace" }
    }
  }
}
```

### Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.p4pilot]
command = "npx"
args = ["-y", "@p4pilot/mcp-server"]
```

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

See [`docs/SPEC.md`](./docs/SPEC.md) for the full design and
[`docs/PLAN.md`](./docs/PLAN.md) for the build plan.

## Roadmap

- [ ] **MVP:** core (runner/parser/client/auto-checkout/asset-guard) + MCP server
- [ ] Polish: README demo GIF, examples, CI, tool reference docs
- [ ] **Phase 2:** React WebView panel (changelist dashboard + review UI),
      embeddable in browser / PC client / **UE / Maya** WebViews
- [ ] Shelved-changelist review workflow
- [ ] Asset dependency surfacing (UE `.uasset` references)

## Contributing

This project is built test-first. See [`AGENTS.md`](./AGENTS.md) for the
execution contract and [`docs/PLAN.md`](./docs/PLAN.md) for open tasks. PRs
welcome once the MVP lands.

## License

[MIT](./LICENSE) © p4pilot contributors
