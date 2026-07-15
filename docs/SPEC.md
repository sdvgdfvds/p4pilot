# p4pilot — Technical Specification

**Status:** authoritative design for the MVP. `docs/PLAN.md` turns this into a
task-by-task TDD work order. If an interface changes during implementation,
update this file in the same commit.

---

## 1. Goal

Give any MCP-compatible AI coding agent **first-class Perforce behavior** so it
can work safely in a game-studio depot: check files out before editing them,
organize work into changelists, avoid choking on binary assets, search depot
code, and review changelists like pull requests.

## 2. Non-goals (MVP)

- No GUI/WebView yet (that is Phase 2).
- No `p4 submit` automation. p4pilot prepares changelists; a human submits.
- No embeddings/vector index. Search is text/grep-based (matches how CLI agents
  actually navigate code).
- No multi-server / replica orchestration.

## 3. Global constraints

- **Language/runtime:** TypeScript (strict), Node.js ≥ 20, **ESM only**
  (`"type": "module"`, `moduleResolution: NodeNext`).
- **Packages:** npm workspaces. Two published packages: `@p4pilot/core`,
  `@p4pilot/mcp-server`.
- **Tests:** Vitest. **100% offline** — all core logic tested against
  `MockP4Runner`. No live `p4`, no network in tests/CI.
- **Build:** `tsup` per package (ESM + CJS + `.d.ts`).
- **Validation:** `zod` for all MCP tool inputs.
- **Process spawning:** `execa` for the real runner.

## 4. Package: `@p4pilot/core`

The Perforce brain. No MCP concerns here — pure, testable logic.

### 4.1 `P4Runner` (the seam that makes everything testable)

```ts
export interface P4Result {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface P4RunOptions {
  cwd?: string;
  input?: string;        // stdin, e.g. for `p4 change -i`
  env?: Record<string, string>;
}

export interface P4Runner {
  /** Runs `p4 -ztag <args>` (the -ztag flag is added by the runner). */
  run(args: string[], opts?: P4RunOptions): Promise<P4Result>;
}
```

- **`ExecaP4Runner implements P4Runner`** — spawns the real `p4` binary via
  `execa`, always injecting `-ztag` as the first global arg for parseable
  output. Constructor takes `{ p4Path?: string; env?: Record<string,string> }`.
  Never throws on non-zero exit; returns the `P4Result` so callers decide.
- **`MockP4Runner implements P4Runner`** — see 4.7.

### 4.2 `ztag` parser — `src/ztag.ts`

`p4 -ztag` emits records as lines of the form `... key value`, records separated
by blank lines. Indexed fields (`depotFile0`, `action0`, …) appear in commands
like `describe`/`opened`.

```ts
/** One record = ordered map of field name -> string value. */
export type ZtagRecord = Map<string, string>;

/** Parse raw -ztag stdout into records (blank-line separated). */
export function parseZtag(stdout: string): ZtagRecord[];

/**
 * Collapse indexed fields (foo0, foo1, …) in a single record into arrays,
 * returning a plain object. e.g. { depotFile: ["//a","//b"], action: ["edit","add"] }
 * Non-indexed fields pass through as strings.
 */
export function groupIndexed(record: ZtagRecord): Record<string, string | string[]>;
```

Parsing rules:
- A line starting with `... ` introduces `key` (up to first space) and `value`
  (remainder, may be empty).
- Lines NOT starting with `... ` are a continuation of the previous field's
  value (append with `\n`). (Perforce emits multi-line values this way.)
- A blank line terminates the current record.
- Leading/trailing blank lines produce no empty records.

### 4.3 Types — `src/types.ts`

```ts
export type P4Action = "edit" | "add" | "delete" | "branch" | "integrate" | "move/add" | "move/delete";

export interface OpenedFile {
  depotFile: string;
  clientFile?: string;
  rev?: number;
  action: P4Action;
  change: string;        // "default" or a CL number as string
  type: string;          // p4 filetype, e.g. "text", "binary+l"
}

export interface FileStat {
  depotFile: string;
  clientFile?: string;
  headType?: string;     // filetype in depot
  headRev?: number;
  haveRev?: number;
  action?: P4Action;     // set if currently opened
  isOpened: boolean;
  isTracked: boolean;    // exists in depot
}

export interface ChangelistSummary {
  change: string;        // CL number or "default"
  description: string;
  status: "pending" | "submitted" | "shelved";
  user?: string;
  client?: string;
  files?: string[];      // depot paths (when known)
}

export interface DescribeResult {
  change: string;
  description: string;
  user?: string;
  files: Array<{ depotFile: string; action: P4Action; rev?: number }>;
  diff?: string;         // unified diff text when requested
}

export class P4PilotError extends Error {
  constructor(message: string, readonly code: P4PilotErrorCode, readonly detail?: string);
}
export type P4PilotErrorCode =
  | "P4_NOT_FOUND"       // p4 binary missing
  | "P4_COMMAND_FAILED"  // non-zero exit
  | "NOT_CONNECTED"      // no P4PORT/login
  | "FILE_NOT_IN_CLIENT" // path not mapped to workspace
  | "INVALID_INPUT";
```

### 4.4 `P4Client` — `src/p4-client.ts`

Typed wrapper. Constructed with a `P4Runner`. Each method builds args, runs,
parses via `ztag`, and maps to the types above. On non-zero exit, throw
`P4PilotError("...", "P4_COMMAND_FAILED", stderr)`.

```ts
export class P4Client {
  constructor(runner: P4Runner);

  info(): Promise<Record<string, string>>;
  opened(opts?: { changelist?: string }): Promise<OpenedFile[]>;
  fstat(files: string[]): Promise<FileStat[]>;
  edit(files: string[], opts?: { changelist?: string }): Promise<OpenedFile[]>;
  add(files: string[], opts?: { changelist?: string }): Promise<OpenedFile[]>;
  deleteFiles(files: string[], opts?: { changelist?: string }): Promise<OpenedFile[]>;
  revert(files: string[]): Promise<string[]>;              // reverted depot paths
  sync(paths?: string[]): Promise<{ synced: number }>;
  where(file: string): Promise<{ depotFile: string; clientFile: string; path: string }>;
  changes(opts?: { status?: "pending" | "submitted"; max?: number; user?: string }): Promise<ChangelistSummary[]>;
  describe(change: string, opts?: { diff?: boolean }): Promise<DescribeResult>;
  filelog(file: string, opts?: { max?: number }): Promise<Array<{ rev: number; change: string; action: P4Action; user: string; description: string }>>;
  newChangelist(description: string): Promise<string>;     // returns new CL number
  reopen(files: string[], changelist: string): Promise<OpenedFile[]>;
}
```

`newChangelist` uses `p4 change -i` with a generated change spec on stdin and
parses the resulting `Change NNNN created.` message.

### 4.5 Asset guard — `src/asset-guard.ts`

```ts
export type AssetKind = "text" | "binary" | "large-asset";

export interface AssetClassification {
  path: string;
  kind: AssetKind;
  filetype?: string;      // from FileStat.headType when available
  sizeBytes?: number;
  shouldRead: boolean;    // false for binary/large-asset
  reason: string;         // human-readable, e.g. "binary extension .uasset"
}

export interface AssetGuardConfig {
  binaryExtensions: string[];   // default list incl. .uasset .umap .fbx .psd .tga .png .wav .mp4 .bin .pak …
  largeAssetExtensions: string[];
  maxTextBytes: number;         // default 1_000_000
}

export function classifyAsset(
  path: string,
  opts?: { stat?: FileStat; sizeBytes?: number; config?: Partial<AssetGuardConfig> }
): AssetClassification;

export const DEFAULT_ASSET_GUARD_CONFIG: AssetGuardConfig;
```

Decision order: explicit `large-asset` extension → `large-asset`; p4 filetype
contains `binary`/`ubinary`/`apple` → `binary`; binary extension → `binary`;
size > `maxTextBytes` → `binary`; else `text`. `shouldRead` is true only for
`text`.

### 4.6 Auto-checkout — `src/auto-checkout.ts` (the killer feature)

```ts
export type CheckoutStatus = "already-open" | "opened" | "added" | "skipped-untracked-ignored";

export interface CheckoutResult {
  path: string;
  status: CheckoutStatus;
  action?: P4Action;
  changelist?: string;
  asset?: AssetClassification;   // populated so the host can warn on binary edits
}

/**
 * Ensure `localPath` is open for edit before an agent modifies it:
 *  - fstat the file
 *  - if already opened -> "already-open"
 *  - else if tracked in depot -> p4 edit -> "opened"
 *  - else (new file) -> p4 add -> "added"
 * Always attaches to `opts.changelist` when provided.
 */
export function ensureOpenForEdit(
  client: P4Client,
  localPath: string,
  opts?: { changelist?: string; assetConfig?: Partial<AssetGuardConfig> }
): Promise<CheckoutResult>;

/** Batch variant; preserves input order, never throws for one bad file (returns per-file result). */
export function ensureOpenForEditMany(
  client: P4Client,
  localPaths: string[],
  opts?: { changelist?: string }
): Promise<CheckoutResult[]>;
```

### 4.7 `MockP4Runner` — `src/testing/mock-runner.ts` (exported for consumers' tests too)

An in-memory fake depot implementing `P4Runner`. Seeded with a `FakeDepot`
description; interprets a subset of `p4` subcommands (`fstat`, `opened`, `edit`,
`add`, `revert`, `where`, `changes`, `describe`, `change -i`, `info`) and emits
**real -ztag-formatted stdout** so it exercises the same parser as production.

```ts
export interface FakeFile {
  depotFile: string;
  clientFile: string;      // absolute local path
  headType?: string;       // "text" | "binary" | "binary+l" | …
  headRev?: number;
  sizeBytes?: number;
  opened?: { action: P4Action; change: string };
}

export interface FakeDepotState {
  root: string;            // client root
  port?: string;
  client?: string;
  user?: string;
  files: FakeFile[];
  changelists?: ChangelistSummary[];
}

export class MockP4Runner implements P4Runner {
  constructor(state: FakeDepotState);
  get state(): FakeDepotState;                 // inspect after operations
  run(args: string[], opts?: P4RunOptions): Promise<P4Result>;
}
```

Mutating commands update `state` (e.g. `edit` sets `opened`), so tests can drive
a workflow and assert on resulting state.

### 4.8 Config — `src/config.ts`

```ts
export interface P4PilotConfig {
  p4Path: string;                    // default "p4"
  mock: boolean;                     // P4PILOT_MOCK=1
  assetGuard: AssetGuardConfig;
  defaultChangelistPrefix: string;   // default "[p4pilot] "
  env: { P4PORT?: string; P4CLIENT?: string; P4USER?: string };
}

/** Merge: defaults < .p4pilot.json (cwd upward) < environment variables. */
export function loadConfig(opts?: { cwd?: string; env?: NodeJS.ProcessEnv }): P4PilotConfig;
```

### 4.9 `src/index.ts`

Barrel export of the public API: runner interface + both runners, `P4Client`,
asset-guard, auto-checkout, changelist helpers, config, types, `P4PilotError`.

## 5. Package: `@p4pilot/mcp-server`

Thin MCP adapter over `@p4pilot/core`, built on `@modelcontextprotocol/sdk`
(stdio transport). Binary name: **`p4pilot-mcp`**.

### 5.1 Startup

- `p4pilot-mcp [--mock] [--cwd <dir>]`.
- `--mock` (or `P4PILOT_MOCK=1`) → construct core with a `MockP4Runner` seeded
  from `examples/mock-depot.json` (bundled) so the server is demoable with zero
  Perforce setup.
- Otherwise construct `ExecaP4Runner` from `loadConfig()`.

### 5.2 Tools (each has a zod input schema; each returns structured text content)

| Tool | Input | Behavior |
|---|---|---|
| `p4_status` | `{}` | opened files + count summary |
| `p4_smart_edit` | `{ paths: string[], changelist?: string }` | `ensureOpenForEditMany`; returns per-file `CheckoutResult`, warns on binary edits |
| `p4_edit` | `{ paths: string[], changelist?: string }` | `client.edit` |
| `p4_add` | `{ paths: string[], changelist?: string }` | `client.add` |
| `p4_revert` | `{ paths: string[] }` | `client.revert` |
| `p4_changelist_create` | `{ description: string }` | `client.newChangelist`, prefixing description with `defaultChangelistPrefix` |
| `p4_changelist_list` | `{ status?: "pending"|"submitted", max?: number }` | `client.changes` |
| `p4_describe` | `{ change: string, diff?: boolean }` | `client.describe` |
| `p4_review` | `{ change: string }` | `describe` with `diff:true`, formatted as a review-ready summary (files + hunks) |
| `p4_asset_info` | `{ path: string }` | `fstat` + `classifyAsset`; returns metadata, refuses to dump binary content |
| `p4_search` | `{ query: string, glob?: string }` | ripgrep/grep over the client workspace, skipping binary assets via asset-guard |
| `p4_filelog` | `{ path: string, max?: number }` | `client.filelog` |

### 5.3 Errors

Tool handlers catch `P4PilotError` and return an MCP tool error with the
`code` and message (never leak stack traces). Unknown errors → generic
`INTERNAL` message.

### 5.4 Tests

- Unit: call each tool's handler with a core built on `MockP4Runner`; assert on
  returned content.
- Integration: connect an in-memory MCP client/server pair (SDK
  `InMemoryTransport`), `listTools`, `callTool("p4_smart_edit", …)`, assert the
  fake depot state changed (file now opened).

## 6. Directory layout (final MVP)

```
packages/core/
  package.json  tsconfig.json  tsup.config.ts
  src/{index,types,ztag,p4-runner,p4-client,asset-guard,auto-checkout,changelist,config}.ts
  src/testing/mock-runner.ts
  test/{ztag,mock-runner,p4-client,asset-guard,auto-checkout,config}.test.ts
packages/mcp-server/
  package.json  tsconfig.json  tsup.config.ts
  src/{index,server,tools/*}.ts
  test/{tools,integration}.test.ts
examples/
  mock-depot.json  claude-code.md  cursor.mcp.json  codex.config.toml
```

## 7. Acceptance criteria (MVP done)

1. `npm install && npm run typecheck && npm test && npm run build` all succeed
   on a clean checkout with **no Perforce installed**.
2. `npx @p4pilot/mcp-server --mock` starts and `p4_smart_edit` opens a file in
   the fake depot end-to-end (proven by the integration test).
3. Every `@p4pilot/core` public function in §4 has direct tests.
4. README quickstart snippets match the shipped CLI flags and tool names.
