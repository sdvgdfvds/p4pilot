# p4pilot Architecture

p4pilot is three packages built around one idea: **keep every bit of Perforce
logic behind a single swappable seam, so the whole system is testable with no
Perforce server anywhere.**

- **`@p4pilot/core`** — the Perforce brain. Runner seam, `-ztag` parser, typed
  `P4Client`, asset guard, auto-checkout, changelist/config helpers. Zero MCP
  knowledge.
- **`@p4pilot/mcp-server`** — a thin MCP adapter (binary `p4pilot-mcp`) that
  exposes core as zod-typed MCP tools over stdio. Zero direct `p4` knowledge.
- **`@p4pilot/web`** — a private React/Vite demo that imports the browser-safe
  core entry and runs it against an in-memory mock depot. No backend.

## Layers

```
AI coding agent                           Browser user
       │ MCP (stdio)                            │ React
       ▼                                        ▼
@p4pilot/mcp-server                       @p4pilot/web
       │ typed calls                            │ browser-safe imports
       └──────────────────┬─────────────────────┘
                          ▼
                   @p4pilot/core
                 P4Client + workflows
                          │ P4Runner
                  ┌───────┴────────┐
                  ▼                ▼
           ExecaP4Runner     MockP4Runner
              real p4       tests / demos
```

## Request flow

Take `p4_smart_edit` (the auto-checkout tool):

1. The MCP client calls the tool with `{ paths, changelist? }`.
2. `mcp-server` validates the arguments against the tool's zod schema, then calls
   the matching **pure handler** (`smartEdit` in `src/tools.ts`). Handlers are
   plain functions of `(ctx, args)` so they can be unit-tested without a
   transport.
3. The handler drives core: `ensureOpenForEditMany(client, paths, …)`.
4. For each path, core `fstat`s the file, decides `edit` vs `add` vs
   `already-open`, attaches the changelist, and runs `classifyAsset` so the host
   can warn on binaries.
5. `P4Client` turns each intent into `p4` args, runs them through a `P4Runner`,
   and parses the `-ztag` output into typed objects.
6. The `P4Runner` is either `ExecaP4Runner` (spawns the real `p4`) or
   `MockP4Runner` (in-memory). **Both emit identical `-ztag` text**, so the same
   parser and client code run in tests and in production.
7. Results are formatted as plain-text tool content. Any `P4PilotError` thrown
   along the way is caught and returned as a tool error carrying its `code`.

## The `P4Runner` seam

Everything Perforce funnels through one interface:

```ts
interface P4Runner {
  run(args: string[], opts?: P4RunOptions): Promise<P4Result>; // {stdout, stderr, exitCode}
}
```

`ExecaP4Runner` always injects `-ztag` as the first global arg for parseable
output and **never throws on non-zero exit** — it returns the `P4Result` and lets
`P4Client` decide. `MockP4Runner` interprets a subset of subcommands (`info`,
`fstat`, `opened`, `edit`, `add`, `revert`, `where`, `changes`, `describe`,
`change -i`, `sync`, `filelog`) against an in-memory `FakeDepotState` and mutates
that state, so tests drive a real workflow and assert on the result. This single
seam is why CI needs no Perforce.

## Browser demo

The web package imports `@p4pilot/core/browser`, which omits `execa`, `node:fs`,
and process configuration. `DemoProvider` owns a `DemoStore`, exposes operation
keys for loading and duplicate suppression, refreshes state after mutations, and
turns failures into a dismissible banner. Workspace and review views therefore
exercise the same client, parser, asset guard, and checkout workflow as the MCP
server while remaining a static site.

## `-ztag` parsing

`p4 -ztag` emits records as `... key value` lines separated by blank lines;
multi-line values continue on non-`... ` lines; indexed fields (`depotFile0`,
`depotFile1`, …) appear in `opened`/`describe`. `parseZtag` turns raw stdout into
ordered `Map` records; `groupIndexed` collapses indexed fields into arrays. See
`SPEC.md` §4.2.

## Asset guard (decision order)

`classifyAsset(path, { stat?, sizeBytes? })` returns `{ kind, shouldRead, reason,
… }` using this order (`SPEC.md` §4.5):

1. explicit **large-asset** extension (`.uasset`, `.umap`, `.fbx`, `.psd`, …) → `large-asset`
2. p4 filetype contains `binary` / `ubinary` / `apple` → `binary`
3. **binary** extension → `binary`
4. size > `maxTextBytes` (default 1 MB) → `binary`
5. otherwise → `text`

`shouldRead` is `true` only for `text`. `p4_asset_info` and `p4_search` both rely
on this so agents never ingest binary bytes.

## Auto-checkout

`ensureOpenForEdit` (`SPEC.md` §4.6) is the feature studios usually hand-roll as
a file-write hook:

```
fstat(path)
  ├─ already opened   → "already-open"
  ├─ tracked in depot → p4 edit → "opened"
  └─ new file         → p4 add  → "added"
（always attaching to opts.changelist when provided; asset classification attached）
```

`ensureOpenForEditMany` runs the batch in input order and never lets one bad path
abort the rest — each path gets its own result.

## Errors

Core throws a typed `P4PilotError(message, code, detail?)`. The server's `guard`
wrapper converts it to `p4pilot error [CODE]: message — detail` and marks the
tool result `isError`. Stack traces are never leaked. Codes are listed in
[`TOOLS.md`](./TOOLS.md#error-codes).

## Why offline-first

Tests and CI must never touch a real Perforce server or the `p4` binary (see
`AGENTS.md`). All core logic is exercised through `MockP4Runner`, and the server
integration test wires an in-memory MCP client/server pair via the SDK's
`InMemoryTransport`. The same `--mock` path ships to users, so anyone can try
every tool with zero Perforce setup.

## Where to go next

- Exact interfaces and types: [`SPEC.md`](./SPEC.md)
- Per-tool inputs/outputs/examples: [`TOOLS.md`](./TOOLS.md)
- Build order & TDD contract: [`PLAN.md`](./PLAN.md), [`../AGENTS.md`](../AGENTS.md)
