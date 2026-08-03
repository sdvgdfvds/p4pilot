# p4pilot — Technical Specification

**Status:** authoritative design for the MVP and shipped Phase 2 browser demo.
`docs/PLAN.md` records the original task-by-task TDD work order. If an interface
changes during implementation, update this file in the same commit.

---

## 1. Goal

Give any MCP-compatible AI coding agent **first-class Perforce behavior** so it
can work safely in a game-studio depot: check files out before editing them,
organize work into changelists, avoid choking on binary assets, search depot
code, and review changelists like pull requests.

## 2. Product boundaries

- The browser UI supports both an offline demo backend and the localhost
  `p4pilot-host` backend. P4V, Unreal Editor, and Maya load this same build.
- No `p4 submit` automation. p4pilot prepares changelists; a human reviews and
  submits them. No MCP tool may bypass that approval boundary.
- No embeddings/vector index. Search is text/grep-based (matches how CLI agents
  actually navigate code).
- No multi-server / replica orchestration.

## 3. Global constraints

- **Language/runtime:** TypeScript (strict), Node.js ≥ 20, **ESM only**
  (`"type": "module"`, `moduleResolution: NodeNext`).
- **Packages:** npm workspaces. Two public packages (`@p4pilot/core`,
  `@p4pilot/mcp-server`) plus the private `@p4pilot/web` demo.
- **Tests:** Vitest. **100% offline** — all core logic tested against
  `MockP4Runner`. No live `p4`, no network in tests/CI.
- **Build:** `tsup` for the public packages (ESM + CJS + `.d.ts`); Vite for the
  browser demo.
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
  input?: string; // stdin, e.g. for `p4 change -i`
  env?: Record<string, string>;
  tagged?: boolean; // defaults to true; false preserves native text output
}

export interface P4Runner {
  /** Runs `p4 -ztag <args>` unless opts.tagged is explicitly false. */
  run(args: string[], opts?: P4RunOptions): Promise<P4Result>;
}
```

- **`ExecaP4Runner implements P4Runner`** — spawns the real `p4` binary via
  `execa`, injecting `-ztag` as the first global arg by default for parseable
  output. Callers may set `tagged: false` for commands whose native text format
  is required, such as unified diffs. Constructor takes
  `{ p4Path?: string; env?: Record<string,string> }`. Never throws on non-zero
  exit; returns the `P4Result` so callers decide.
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
export function groupIndexed(
  record: ZtagRecord,
): Record<string, string | string[]>;
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

export interface ShelvedReviewResult extends DescribeResult {
  reviewType: "shelved";
}

export class P4PilotError extends Error {
  constructor(message: string, readonly code: P4PilotErrorCode, readonly detail?: string);
}
export type P4PilotErrorCode =
  | "P4_NOT_FOUND"       // p4 binary missing
  | "P4_COMMAND_FAILED"  // non-zero exit
  | "NOT_CONNECTED"      // no P4PORT/login
  | "FILE_NOT_IN_CLIENT" // path not mapped to workspace
  | "NO_SHELVED_FILES"   // successful describe response had no shelves
  | "ASSET_DEPENDENCIES_UNAVAILABLE" // no valid UE Asset Registry provider
  | "ASSET_NOT_FOUND"     // requested package absent from registry export
  | "INVALID_INPUT"
  | "POLICY_DENIED";     // SafetyPolicy rejected the requested action
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
  deleteFiles(
    files: string[],
    opts?: { changelist?: string },
  ): Promise<OpenedFile[]>;
  revert(files: string[]): Promise<string[]>; // reverted depot paths
  sync(paths?: string[]): Promise<{ synced: number }>;
  where(
    file: string,
  ): Promise<{ depotFile: string; clientFile: string; path: string }>;
  changes(opts?: {
    status?: "pending" | "submitted";
    max?: number;
    user?: string;
  }): Promise<ChangelistSummary[]>;
  describe(change: string, opts?: { diff?: boolean }): Promise<DescribeResult>;
  describeShelved(change: string): Promise<ShelvedReviewResult>;
  filelog(
    file: string,
    opts?: { max?: number },
  ): Promise<
    Array<{
      rev: number;
      change: string;
      action: P4Action;
      user: string;
      description: string;
    }>
  >;
  newChangelist(description: string): Promise<string>; // returns new CL number
  reopen(files: string[], changelist: string): Promise<OpenedFile[]>;
}
```

`describeShelved` first runs tagged `p4 describe -S -s <change>` and parses
indexed file metadata across multiple ztag records. Real Perforce suppresses
diff text when `-ztag` is present, so it then runs untagged
`p4 describe -S -du <change>` and extracts every native unified diff segment.
Neither call syncs, unshelves, or otherwise changes the workspace. A successful
metadata response with no shelved files raises `NO_SHELVED_FILES`; a non-zero
Perforce response remains `P4_COMMAND_FAILED`.

`newChangelist` uses `p4 change -i` with a generated change spec on stdin and
parses the resulting `Change NNNN created.` message.

### 4.5 Asset guard — `src/asset-guard.ts`

```ts
export type AssetKind = "text" | "binary" | "large-asset";

export interface AssetClassification {
  path: string;
  kind: AssetKind;
  filetype?: string; // from FileStat.headType when available
  sizeBytes?: number;
  shouldRead: boolean; // false for binary/large-asset
  reason: string; // human-readable, e.g. "binary extension .uasset"
}

export interface AssetGuardConfig {
  binaryExtensions: string[]; // default list incl. .uasset .umap .fbx .psd .tga .png .wav .mp4 .bin .pak …
  largeAssetExtensions: string[];
  maxTextBytes: number; // default 1_000_000
}

export function classifyAsset(
  path: string,
  opts?: {
    stat?: FileStat;
    sizeBytes?: number;
    config?: Partial<AssetGuardConfig>;
  },
): AssetClassification;

export const DEFAULT_ASSET_GUARD_CONFIG: AssetGuardConfig;
```

Decision order: explicit `large-asset` extension → `large-asset`; p4 filetype
contains `binary`/`ubinary`/`apple` → `binary`; binary extension → `binary`;
size > `maxTextBytes` → `binary`; else `text`. `shouldRead` is true only for
`text`.

### 4.6 Auto-checkout — `src/auto-checkout.ts` (the killer feature)

```ts
export type CheckoutStatus =
  "already-open" | "opened" | "added" | "skipped-untracked-ignored";

export interface CheckoutResult {
  path: string;
  status: CheckoutStatus;
  action?: P4Action;
  changelist?: string;
  asset?: AssetClassification; // populated so the host can warn on binary edits
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
  opts?: { changelist?: string; assetConfig?: Partial<AssetGuardConfig> },
): Promise<CheckoutResult>;

/** Batch variant; preserves input order, never throws for one bad file (returns per-file result). */
export function ensureOpenForEditMany(
  client: P4Client,
  localPaths: string[],
  opts?: { changelist?: string },
): Promise<CheckoutResult[]>;
```

### 4.7 `MockP4Runner` — `src/testing/mock-runner.ts` (exported for consumers' tests too)

An in-memory fake depot implementing `P4Runner`. Seeded with a `FakeDepot`
description; interprets a subset of `p4` subcommands (`fstat`, `opened`, `edit`,
`add`, `delete`, `revert`, `reopen`, `sync`, `where`, `changes`, `describe`,
`change -i`, `info`) and emits
**real -ztag-formatted stdout** so it exercises the same parser as production.

```ts
export interface FakeFile {
  depotFile: string;
  clientFile: string; // absolute local path
  headType?: string; // "text" | "binary" | "binary+l" | …
  headRev?: number;
  sizeBytes?: number;
  opened?: { action: P4Action; change: string };
}

export interface FakeDepotState {
  root: string; // client root
  port?: string;
  client?: string;
  user?: string;
  files: FakeFile[];
  changelists?: ChangelistSummary[];
  shelvedChangelists?: FakeShelvedChangelist[];
}

export interface FakeShelvedFile {
  depotFile: string;
  action: P4Action;
  rev?: number;
  type?: string;
  diff?: string;
}

export interface FakeShelvedChangelist {
  change: string;
  description: string;
  user?: string;
  client?: string;
  files: FakeShelvedFile[];
}

export class MockP4Runner implements P4Runner {
  constructor(state: FakeDepotState);
  get state(): FakeDepotState; // inspect after operations
  run(args: string[], opts?: P4RunOptions): Promise<P4Result>;
}
```

Mutating commands update `state` (e.g. `edit` sets `opened`), so tests can drive
a workflow and assert on resulting state.

### 4.8 Config — `src/config.ts`

```ts
export interface P4PilotConfig {
  p4Path: string; // default "p4"
  mock: boolean; // P4PILOT_MOCK=1
  assetGuard: AssetGuardConfig;
  defaultChangelistPrefix: string; // default "[p4pilot] "
  assetDependencies: { registryJsonPath?: string };
  env: { P4PORT?: string; P4CLIENT?: string; P4USER?: string };
}

/** Merge: defaults < .p4pilot.json (cwd upward) < environment variables. */
export function loadConfig(opts?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): P4PilotConfig;
```

### 4.9 `src/index.ts`

Barrel export of the public API: runner interface + both runners, `P4Client`,
asset-guard, auto-checkout, changelist helpers, config, types, `P4PilotError`,
safety policy, and audit.

### 4.10 Asset dependencies — `src/asset-dependencies.ts`

Asset relationships come from an injectable provider. Core never parses
`.uasset` bytes and never assumes that a depot path maps to an Unreal package.

```ts
export type AssetDependencyDirection = "dependencies" | "referencers" | "both";

export interface AssetDependencyRecord {
  path: string; // Unreal package name, e.g. /Game/Characters/Hero
  dependencies: string[];
  referencers: string[];
}

export interface AssetDependencyProvider {
  readonly name: string;
  getAsset(path: string): Promise<AssetDependencyRecord | undefined>;
}

export interface AssetDependencyReport {
  path: string;
  provider: string;
  direction: AssetDependencyDirection;
  depth: number;
  directDependencies: string[];
  directReferencers: string[];
  dependencies: Array<{ path: string; depth: number }>;
  referencers: Array<{ path: string; depth: number }>;
  missingAssets: string[];
  risks: string[];
}

export function resolveAssetDependencies(
  provider: AssetDependencyProvider,
  path: string,
  opts?: { direction?: AssetDependencyDirection; depth?: number },
): Promise<AssetDependencyReport>;
```

Traversal is breadth-first, deduplicated, limited to depth 1–10, and reports
cycles, missing records, depth cutoffs, and the Asset Registry's inability to
observe references created only at runtime. `StaticAssetDependencyProvider`
supports deterministic offline fixtures.

### 4.11 Safety policy — `src/policy.ts`

In-process allow/deny gate for agent-facing actions. This is **tool policy**,
not Helix Core authorization: an agent that can run an unrestricted shell with
valid P4 credentials can still call `p4` directly and bypass p4pilot. Production
deployments must pair this layer with a restricted P4 user and server-side
protections (see `docs/SECURITY.md`).

**Submit is always denied** (`denySubmit` behavior is hard-coded): `checkPolicy`
rejects `action === "submit"` even if a custom policy listed it. Shipped presets
never include `submit` in `allowedActions`. There is still **no** `p4_submit`
MCP tool.

```ts
/**
 * High-level actions policies allow or deny. MCP tools map onto these
 * (e.g. `p4_smart_edit` → `edit`; `p4_review` / `p4_shelved_review` → `read`).
 * `submit` is never exposed as a tool but remains a first-class action so
 * policy checks always reject it.
 */
export type PolicyAction =
  | "read"
  | "edit"
  | "add"
  | "delete"
  | "revert"
  | "sync"
  | "reopen"
  | "changelist_create"
  | "changelist_list"
  | "submit"
  | "audit_tail";

export interface SafetyPolicy {
  /** Stable id: `default` | `restricted-agent` | `read-only`. */
  name: string;
  /** Actions this policy permits. Anything not listed is denied. */
  allowedActions: ReadonlySet<PolicyAction>;
  /**
   * When true, edit/add/reopen on binary or large-asset paths are denied
   * (uses `classifyAsset`).
   */
  protectBinaryAssets: boolean;
  /**
   * If non-empty, every path supplied in the check context must match at
   * least one prefix (separators normalized `\\` → `/`; exact path or nested
   * under the prefix with a path boundary). Empty/undefined = no path
   * restriction. Matching is case-sensitive (depot paths are case-sensitive
   * on Helix by default).
   */
  pathAllowlist?: readonly string[];
}

export interface PolicyCheckContext {
  paths?: string[];
  changelist?: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  action: PolicyAction;
  reason?: string;
}

/** Full workspace tooling except submit. */
export const DEFAULT_SAFETY_POLICY: SafetyPolicy;

/**
 * Restricted agent: prepare edits/changelists; no delete, sync, or submit.
 * Allows: read, edit, add, revert, reopen, changelist_create, changelist_list,
 * audit_tail. `protectBinaryAssets: true`.
 */
export const RESTRICTED_AGENT_POLICY: SafetyPolicy;

/**
 * Inspection only: read, changelist_list, audit_tail.
 * (Review tools map to `read` and therefore remain allowed.)
 * `protectBinaryAssets: true`.
 */
export const READ_ONLY_POLICY: SafetyPolicy;

/**
 * Layer a path allowlist onto a base policy. Empty `prefixes` clears the
 * allowlist (returns base unchanged when it had none).
 */
export function withPathAllowlist(
  basePolicy: SafetyPolicy,
  prefixes: readonly string[],
): SafetyPolicy;

/** Normalize separators for allowlist matching (`\\` → `/`). */
export function normalizePolicyPath(path: string): string;

/** True if `path` equals a prefix or is nested under it. */
export function pathMatchesAllowlist(
  path: string,
  allowlist: readonly string[],
): boolean;

export function checkPolicy(
  policy: SafetyPolicy,
  action: PolicyAction,
  context?: PolicyCheckContext,
): PolicyCheckResult;

/**
 * Throws `P4PilotError` with code `POLICY_DENIED` when disallowed.
 * No-op when allowed.
 */
export function assertPolicyAllowed(
  policy: SafetyPolicy,
  action: PolicyAction,
  context?: PolicyCheckContext,
): void;
```

**`checkPolicy` evaluation order:**

1. **`submit` hard deny** — always, even if listed in `allowedActions` or on an
   allowlisted path.
2. **`allowedActions`** — action must be in the set.
3. **`pathAllowlist`** (when defined and non-empty):
   - Path-based mutations (`edit`, `add`, `delete`, `revert`, `sync`, `reopen`)
     require a non-empty `context.paths`; missing/empty → deny.
   - `read` / `changelist_create` / `changelist_list` / `audit_tail` do **not**
     require paths; when paths are provided they are still checked.
   - Every provided path must match at least one allowlist prefix.
4. **`protectBinaryAssets`** — when true, `edit`/`add`/`reopen` deny binary /
   large-asset paths via `classifyAsset`.

Shipped presets leave `pathAllowlist` **undefined** (no path restriction).
Studios layer sandbox prefixes with `withPathAllowlist` or via MCP env
`P4PILOT_PATH_ALLOWLIST` (see §5.1).

Preset summary:

| Preset                    | `name`             | Allows (conceptually)             | Always denies              | `pathAllowlist` |
| ------------------------- | ------------------ | --------------------------------- | -------------------------- | --------------- |
| `DEFAULT_SAFETY_POLICY`   | `default`          | All non-submit actions            | `submit`                   | undefined       |
| `RESTRICTED_AGENT_POLICY` | `restricted-agent` | prepare + review (no delete/sync) | `submit`, `delete`, `sync` | undefined       |
| `READ_ONLY_POLICY`        | `read-only`        | read / list / audit_tail          | all writes + `submit`      | undefined       |

### 4.12 Audit — `src/audit.ts`

In-process event stream for tool invocations (deny / success / error). Core
provides types, `createAuditEvent`, and `MemoryAuditSink`; hosts may implement
`AuditSink`.

```ts
export type AuditDecision = "deny" | "success" | "error";

export interface AuditEvent {
  id: string;
  timestamp: string; // ISO-8601
  tool: string; // MCP tool name, e.g. "p4_edit"
  action: PolicyAction;
  decision: AuditDecision;
  actor?: string;
  paths?: string[];
  changelist?: string;
  durationMs?: number;
  message?: string;
}

export interface AuditSink {
  record(event: AuditEvent): void;
  /** Most recent events, newest last. Defaults to all retained events. */
  tail(limit?: number): AuditEvent[];
}

export interface CreateAuditEventInput {
  tool: string;
  action: PolicyAction;
  decision: AuditDecision;
  actor?: string;
  paths?: string[];
  changelist?: string;
  durationMs?: number;
  message?: string;
  id?: string;
  timestamp?: string;
}

export function createAuditEvent(input: CreateAuditEventInput): AuditEvent;

/** In-memory ring buffer (default max 1000). Not durable across restarts. */
export class MemoryAuditSink implements AuditSink {
  constructor(maxEvents?: number); // default 1_000
  record(event: AuditEvent): void;
  tail(limit?: number): AuditEvent[];
  clear(): void;
}
```

`createAuditEvent` fills `id` and `timestamp` when omitted. Audit is for
accountability and demos — not a cryptographic ledger and not a substitute for
Helix journal / server logs.

Also in `src/audit.ts` (browser-safe):

```ts
/** Fan-out sink: record to both; tail from primary. */
export class TeeAuditSink implements AuditSink {
  constructor(primary: AuditSink, secondary: AuditSink);
}
```

### 4.12.1 File-backed audit — `src/jsonl-audit.ts` (Node only)

Not exported from the browser entry (uses `node:fs`).

```ts
export interface JsonlFileAuditSinkOptions {
  filePath: string;
  maxEvents?: number; // in-memory tail buffer, default 1000
}

export class JsonlFileAuditSink implements AuditSink {
  readonly filePath: string; // resolved absolute path
  constructor(opts: JsonlFileAuditSinkOptions);
  record(event: AuditEvent): void;
  tail(limit?: number): AuditEvent[];
}

/** `P4PILOT_AUDIT_LOG` set → JsonlFileAuditSink; else MemoryAuditSink. */
export function createAuditSinkFromEnv(env: NodeJS.ProcessEnv): AuditSink;
```

`JsonlFileAuditSink` appends one JSON object per line. Empty path throws
`INVALID_INPUT` at construction. Runtime write failures are swallowed so agent
tools keep working; memory tail still updates.

## 5. Package: `@p4pilot/mcp-server`

Thin MCP adapter over `@p4pilot/core`, built on `@modelcontextprotocol/sdk`
(stdio transport). Binary names: **`p4pilot-mcp`**, **`p4pilot-host`**, and the
Windows demo controller **`p4pilot-demo`**.

### 5.1 Startup

- `p4pilot-mcp [--mock] [--cwd <dir>]`.
- `p4pilot-host [--mock] [--host <loopback>] [--port <n>] [--web-root <dir>]`
  serves the shared UI and JSON API. It rejects non-loopback bind addresses.
- `p4pilot-demo <start|reset> --repo-root <dir> --demo-root <dir>` starts the
  dedicated local p4d/host/P4V stack or restores the demo client. The start path
  waits for both health checks; reset deletes shelves before pending changes,
  reverts the client, and force-syncs it. It never invokes `p4 submit`.
- `--mock` (or `P4PILOT_MOCK=1`) → construct core with a `MockP4Runner` seeded
  by the bundled `createMockDepot()` module so the server is demoable with zero
  Perforce setup. Each server receives independent mutable state.
- Otherwise construct `ExecaP4Runner` from `loadConfig()`.
- `P4PILOT_AUDIT_LOG=<path>` selects durable JSONL audit via
  `createAuditSinkFromEnv` (default: in-memory only).
- `P4PILOT_POLICY=default|restricted-agent|read-only` selects the in-process
  `SafetyPolicy` attached to `ToolContext` (default: `default` →
  `DEFAULT_SAFETY_POLICY` via `resolveSafetyPolicy`). Unknown values throw at
  startup: `unknown P4PILOT_POLICY "…" (expected default | restricted-agent | read-only)`.

### 5.1.1 `ToolContext` + policy/audit wiring

Handlers receive a shared context object (not only `P4Client`). The server
always attaches policy + audit from `buildCore`:

```ts
export interface ToolContext {
  client: P4Client;
  config: P4PilotConfig;
  search: Searcher;
  assetDependencies: AssetDependencyProvider;
  policy: SafetyPolicy;
  audit: AuditSink;
  actor?: string;
}
```

Every registered tool runs through `withPolicyAndAudit` (`src/safe-tool.ts`):

1. `checkPolicy(ctx.policy, action, { paths, changelist })` before the handler.
2. On deny → `audit.record(… decision: "deny")` and tool error
   `p4pilot error [POLICY_DENIED]: …` (never uncaught).
3. On allow → run handler; then `audit.record` with `success` or `error`
   (and `durationMs`).

Tool → `PolicyAction` mapping (representative):

| Tools                                                                                                                                         | `PolicyAction`      |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `p4_status`, `p4_where`, `p4_describe`, `p4_review`, `p4_shelved_review`, `p4_asset_info`, `p4_asset_dependencies`, `p4_filelog`, `p4_search` | `read`              |
| `p4_smart_edit`, `p4_edit`                                                                                                                    | `edit`              |
| `p4_add`                                                                                                                                      | `add`               |
| `p4_delete`                                                                                                                                   | `delete`            |
| `p4_revert`                                                                                                                                   | `revert`            |
| `p4_sync`                                                                                                                                     | `sync`              |
| `p4_reopen`                                                                                                                                   | `reopen`            |
| `p4_changelist_create`                                                                                                                        | `changelist_create` |
| `p4_changelist_list`                                                                                                                          | `changelist_list`   |
| `p4_audit_tail`                                                                                                                               | `audit_tail`        |

No tool maps to `submit`.

### 5.2 Tools (each has a zod input schema; each returns structured text content)

| Tool                    | Input                                        | Behavior                                                                          |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| `p4_status`             | `{}`                                         | opened files + count summary                                                      |
| `p4_smart_edit`         | `{ paths: string[], changelist?: string }`   | `ensureOpenForEditMany`; returns per-file `CheckoutResult`, warns on binary edits |
| `p4_edit`               | `{ paths: string[], changelist?: string }`   | `client.edit`                                                                     |
| `p4_add`                | `{ paths: string[], changelist?: string }`   | `client.add`                                                                      |
| `p4_delete`             | `{ paths: string[], changelist?: string }`   | `client.deleteFiles`                                                              |
| `p4_revert`             | `{ paths: string[] }`                        | `client.revert`                                                                   |
| `p4_sync`               | `{ paths?: string[] }`                       | `client.sync`                                                                     |
| `p4_reopen`             | `{ paths: string[], changelist: string }`    | `client.reopen`                                                                   |
| `p4_where`              | `{ path: string }`                           | `client.where`                                                                    |
| `p4_changelist_create`  | `{ description: string }`                    | `client.newChangelist`, prefixing description with `defaultChangelistPrefix`      |
| `p4_changelist_list`    | `{ status?: "pending"                        | "submitted", max?: number }`                                                      | `client.changes` |
| `p4_describe`           | `{ change: string, diff?: boolean }`         | `client.describe`                                                                 |
| `p4_review`             | `{ change: string }`                         | pending workspace review via `describe` with `diff:true`                          |
| `p4_shelved_review`     | `{ change: string }`                         | server-side shelved review via `client.describeShelved`; never changes workspace  |
| `p4_asset_info`         | `{ path: string }`                           | `fstat` + `classifyAsset`; returns metadata, refuses to dump binary content       |
| `p4_asset_dependencies` | `{ path, direction?, depth? }`               | query injected UE Asset Registry provider; return links, missing assets, risks    |
| `p4_search`             | `{ query: string, glob?: string }`           | ripgrep/grep over the client workspace, skipping binary assets via asset-guard    |
| `p4_filelog`            | `{ path: string, max?: number }`             | `client.filelog`                                                                  |
| `p4_audit_tail`         | `{ limit?: number }` (positive int, max 500) | `ctx.audit.tail(limit)` as pretty-printed JSON                                    |

There is **no** `p4_submit` tool.

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

### 5.5 Unreal Asset Registry provider

The Node server loads a zod-validated, versioned JSON export when
`P4PILOT_UE_ASSET_REGISTRY_JSON` or
`.p4pilot.json#assetDependencies.registryJsonPath` is set. In `--mock` mode it
uses a bundled static graph. Without either source, the tool returns
`ASSET_DEPENDENCIES_UNAVAILABLE`; it never fabricates an empty graph. See
[`UNREAL_ASSET_DEPENDENCIES.md`](./UNREAL_ASSET_DEPENDENCIES.md).

### 5.6 Human submit boundary

The MCP surface intentionally stops at pending and shelved changelists. It may
create, populate, describe, and review a changelist, but it does not expose
`p4 submit`. Submission remains a deliberate human action after review.

**Dual control:** in-process `SafetyPolicy` always denies `submit` and the MCP
surface has no submit tool — necessary but not sufficient. An agent with
unrestricted shell access and valid P4 credentials can still invoke `p4 submit`
outside p4pilot. Production and studio demos must also use a restricted Helix
user and server-side submit deny (protections / permissions). See
[`SECURITY.md`](./SECURITY.md).

### 5.7 Local host service

`p4pilot-host` exposes a loopback-only JSON API and serves `packages/web/dist`
from the same origin. Routes are limited to the UI workflows:

- `GET /api/health`
- `GET /api/workspace` — connection, opened files, pending changelists
- `GET /api/asset-info?path=...`
- `GET /api/review?change=...`
- `GET /api/audit?limit=N` — recent policy/tool audit events
- `GET /api/policy` — active safety policy (`name`, `allowedActions`, `protectBinaryAssets`, `pathAllowlist`, `submitAllowed: false`)
- `POST /api/smart-edit`, `/api/revert`, `/api/changelists`

Responses use typed JSON errors. There is no submit route. Core behavior remains
behind `P4Client`; the HTTP layer does not duplicate Perforce commands.

## 6. Package: `@p4pilot/web`

A private React/Vite application deployed to GitHub Pages and served locally by
`p4pilot-host`. A `P4PilotBackend` interface selects either the in-browser
`DemoStore` or `HttpBackend` without changing views or components.

```ts
export interface P4PilotBackend {
  getWorkspace(): Promise<{
    connection: {
      mode: "mock" | "live";
      workspace: string;
      user?: string;
      root?: string;
    };
    files: FileView[];
    changelists: ChangelistSummary[];
  }>;
  smartEdit(clientFile: string, changelist?: string): Promise<unknown>;
  createChangelist(description: string): Promise<string>;
  revert(clientFile: string): Promise<unknown>;
  assetInfo(path: string): Promise<AssetInfoData>;
  review(change: string): Promise<ReviewData>;
  /** Recent policy/tool audit events (host `GET /api/audit`). Newest last. */
  listAuditEvents(limit?: number): Promise<AuditEvent[]>;
  /** Active safety policy (host `GET /api/policy`) for the header status badge. */
  getPolicy(): Promise<PolicyInfo>;
}

export interface PolicyInfo {
  name: string;
  allowedActions: string[];
  protectBinaryAssets: boolean;
  pathAllowlist: string[] | null;
  submitAllowed: false;
}
```

### 6.1 Views

- **Workspace dashboard:** lists visible/opened files, asset classifications,
  status, smart checkout, revert, asset metadata, and pending changelists.
- **Changelist review:** selects a pending changelist and renders its files plus
  a seeded unified diff.
- **Policy audit:** table of recent audit events (time, decision, tool, action,
  reason) with refresh; `DemoStore` seeds allow/deny samples for offline demo.
- **Header policy status:** badge with policy name, always-on "submit blocked",
  and optional path-allowlist summary from `getPolicy()`.

### 6.2 Async behavior

`DemoProvider` owns the injected backend and refreshes view state after mutations.
Every UI operation has a stable operation key, ignores duplicate in-flight
requests, exposes a loading state, and maps failures to a dismissible error
banner. The header also shows mock/live/disconnected connection state and the
active safety policy badge. Asset and review responses are guarded against stale
updates.

### 6.3 Deployment

The Vite base is `/p4pilot/`. `.github/workflows/pages.yml` builds
`packages/web/dist` and deploys it to GitHub Pages after pushes to `main`.
With no query parameter the static demo uses `DemoStore`; `?backend=local`
connects `HttpBackend` to the page's origin.

### 6.4 Directory layout

```
packages/core/
  package.json  tsconfig.json  tsup.config.ts
  src/{index,types,ztag,p4-runner,p4-client,asset-guard,asset-dependencies,auto-checkout,changelist,config,policy,audit}.ts
  src/testing/mock-runner.ts
  test/{ztag,mock-runner,p4-client,asset-guard,asset-dependencies,auto-checkout,config,policy,audit,policy-audit}.test.ts
packages/mcp-server/
  package.json  tsconfig.json  tsup.config.ts
  src/{index,http,server,host-service,host-cli,tools,safe-tool,core-factory,mock-depot,asset-dependency-provider}.ts
  test/{tools,integration,host-service,core-factory,asset-dependency-provider}.test.ts
packages/web/
  package.json  vite.config.ts  index.html
  src/{App,diff,styles}.ts(x)
  src/components/*.tsx  src/demo/*.ts(x)  src/backend/*.ts
hosts/
  p4v/  unreal/  maya/
examples/
  claude-code.md  cursor.mcp.json  codex.config.toml
  restricted-agent/
```

## 7. Acceptance criteria (MVP done)

1. `npm install && npm run typecheck && npm test && npm run build` all succeed
   on a clean checkout with **no Perforce installed**.
2. `npx @p4pilot/mcp-server --mock` starts and `p4_smart_edit` opens a file in
   the fake depot end-to-end (proven by the integration test).
3. Every `@p4pilot/core` public function in §4 has direct tests.
4. README quickstart snippets match the shipped CLI flags and tool names.
5. The browser demo builds without Node polyfills, supports checkout/revert and
   changelist review, reports async failures visibly, and deploys via Pages.
6. No automated path submits a real changelist; submission remains human-owned.
7. The localhost host serves the same web build to P4V, Unreal, and Maya, and
   shared backend tests cover connection, workspace, asset, review, and errors.
