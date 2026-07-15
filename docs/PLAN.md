# p4pilot Implementation Plan

> **For agentic workers:** Execute these tasks **in order**, test-first. Each
> step is one small action. Check the box when done. The authoritative design
> is [`SPEC.md`](./SPEC.md); the rules are in [`../AGENTS.md`](../AGENTS.md).

**Goal:** Ship an MCP server + core library that give AI coding agents
first-class Perforce behavior (auto-checkout, changelist planning, asset
guarding, changelist review), fully testable offline.

**Architecture:** `@p4pilot/core` holds all Perforce logic behind a `P4Runner`
seam (real `execa` runner + in-memory `MockP4Runner`). `@p4pilot/mcp-server`
exposes that logic as MCP tools. See `SPEC.md` §4–§5.

**Tech stack:** TypeScript (strict, ESM), Node ≥20, npm workspaces, Vitest,
tsup, zod, execa, `@modelcontextprotocol/sdk`.

## Global constraints

- ESM only (`"type": "module"`, `NodeNext`). Strict TS incl.
  `noUncheckedIndexedAccess`.
- **Tests never touch a real Perforce server or the real `p4` binary.** Use
  `MockP4Runner`.
- TDD per task: write failing test → run (fail) → implement → run (pass) →
  commit. Conventional-commit messages.
- Don't exceed the current task's scope. Record extra ideas under "Discovered
  follow-ups" at the end.

---

## Milestone 1 — `@p4pilot/core`

### Task 1.1: Package scaffold + runner seam + error type

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`,
  `packages/core/tsup.config.ts`
- Create: `packages/core/src/p4-runner.ts`, `packages/core/src/types.ts`
- Create: `packages/core/src/index.ts`

**Produces (interfaces other tasks consume):** `P4Runner`, `P4Result`,
`P4RunOptions` (SPEC §4.1); `P4PilotError`, `P4PilotErrorCode`, `OpenedFile`,
`FileStat`, `ChangelistSummary`, `DescribeResult`, `P4Action` (SPEC §4.3).

- [ ] **Step 1** — `packages/core/package.json`: name `@p4pilot/core`, `type:module`,
  `main`/`module`/`types` pointing at `dist/`, `exports` map (`.` and
  `./testing`), scripts `build` (`tsup`), `clean` (`rimraf dist` or `rm -rf dist`).
  deps: `execa`. devDeps: `tsup`, `typescript`, `vitest`, `@types/node`.
- [ ] **Step 2** — `tsconfig.json` extends `../../tsconfig.base.json`, `outDir dist`,
  `rootDir src`, `include ["src"]`.
- [ ] **Step 3** — `tsup.config.ts`: entries `src/index.ts` and
  `src/testing/mock-runner.ts`; formats `["esm","cjs"]`; `dts:true`; `clean:true`.
- [ ] **Step 4** — Write `src/types.ts` verbatim from SPEC §4.3 (all types +
  `P4PilotError` class).
- [ ] **Step 5** — Write `src/p4-runner.ts`: the `P4Runner`/`P4Result`/
  `P4RunOptions` interfaces plus `ExecaP4Runner`. `ExecaP4Runner.run` calls
  `execa(p4Path, ["-ztag", ...args], { input, cwd, env, reject:false })` and
  maps to `P4Result` (`{stdout, stderr, exitCode}`). If execa throws `ENOENT`,
  throw `P4PilotError("p4 binary not found", "P4_NOT_FOUND")`.
- [ ] **Step 6** — `src/index.ts` re-exports types + runner. Run
  `npm run typecheck`. Expected: clean.
- [ ] **Step 7** — Commit: `chore(core): scaffold package, runner seam, types`.

### Task 1.2: `-ztag` parser

**Files:** Create `src/ztag.ts`; Test `test/ztag.test.ts`.
**Produces:** `parseZtag(stdout): ZtagRecord[]`, `groupIndexed(record)` (SPEC §4.2).

- [ ] **Step 1 — failing test** (`test/ztag.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { parseZtag, groupIndexed } from "../src/ztag.js";

describe("parseZtag", () => {
  it("parses two records separated by a blank line", () => {
    const out = "... depotFile //depot/a.c\n... action edit\n\n... depotFile //depot/b.c\n... action add\n";
    const recs = parseZtag(out);
    expect(recs).toHaveLength(2);
    expect(recs[0]!.get("depotFile")).toBe("//depot/a.c");
    expect(recs[0]!.get("action")).toBe("edit");
    expect(recs[1]!.get("action")).toBe("add");
  });

  it("treats non-'... ' lines as a continuation of the previous value", () => {
    const out = "... desc first line\nsecond line\n";
    const recs = parseZtag(out);
    expect(recs[0]!.get("desc")).toBe("first line\nsecond line");
  });

  it("ignores leading/trailing blank lines (no empty records)", () => {
    expect(parseZtag("\n\n... a 1\n\n\n")).toHaveLength(1);
  });
});

describe("groupIndexed", () => {
  it("collapses foo0, foo1 into arrays", () => {
    const rec = new Map([["depotFile0","//a"],["depotFile1","//b"],["change","7"]]);
    expect(groupIndexed(rec)).toEqual({ depotFile: ["//a","//b"], change: "7" });
  });
});
```

- [ ] **Step 2** — Run `npx vitest run packages/core/test/ztag.test.ts`. Expected: FAIL.
- [ ] **Step 3** — Implement `src/ztag.ts` per SPEC §4.2 parsing rules.
- [ ] **Step 4** — Run the test. Expected: PASS. Then `npm run typecheck`.
- [ ] **Step 5** — Commit: `feat(core): add -ztag parser`.

### Task 1.3: `MockP4Runner` (fake depot)

**Files:** Create `src/testing/mock-runner.ts`; Test `test/mock-runner.test.ts`.
**Consumes:** `P4Runner`, types. **Produces:** `MockP4Runner`, `FakeDepotState`,
`FakeFile` (SPEC §4.7). Emits genuine `-ztag` stdout.

- [ ] **Step 1 — failing test:** seed a depot with one tracked text file; assert:
  (a) `run(["fstat", file])` stdout parses to a record with `headType text` and
  `depotFile`; (b) `run(["edit", file])` sets `state.files[0].opened.action` to
  `"edit"`; (c) `run(["opened"])` then lists it. Use `parseZtag` to verify
  output is real ztag.

```ts
import { describe, it, expect } from "vitest";
import { MockP4Runner } from "../src/testing/mock-runner.js";
import { parseZtag } from "../src/ztag.js";

const seed = () => new MockP4Runner({
  root: "/ws", port: "ssl:x:1666", client: "c", user: "u",
  files: [{ depotFile: "//depot/a.c", clientFile: "/ws/a.c", headType: "text", headRev: 1, sizeBytes: 10 }],
});

describe("MockP4Runner", () => {
  it("fstat emits parseable ztag with headType", async () => {
    const r = await seed().run(["fstat", "/ws/a.c"]);
    expect(r.exitCode).toBe(0);
    expect(parseZtag(r.stdout)[0]!.get("headType")).toBe("text");
  });
  it("edit opens the file in state", async () => {
    const m = seed();
    await m.run(["edit", "/ws/a.c"]);
    expect(m.state.files[0]!.opened?.action).toBe("edit");
  });
  it("add creates an opened, untracked file", async () => {
    const m = seed();
    await m.run(["add", "/ws/new.c"]);
    expect(m.state.files.find(f => f.clientFile === "/ws/new.c")?.opened?.action).toBe("add");
  });
});
```

- [ ] **Step 2** — Run test. Expected: FAIL.
- [ ] **Step 3** — Implement `MockP4Runner`: dispatch on `args[0]` (strip a
  leading `-ztag` if present). Implement `info, fstat, opened, edit, add,
  revert, where, changes, describe, change -i`. Format output as `... key value`
  records. Mutate `state` for `edit`/`add`/`revert`.
- [ ] **Step 4** — Run test. Expected: PASS. Typecheck.
- [ ] **Step 5** — Commit: `feat(core): add in-memory MockP4Runner fake depot`.

### Task 1.4: `P4Client` wrapper

**Files:** Create `src/p4-client.ts`; Test `test/p4-client.test.ts` (built on
`MockP4Runner`). **Produces:** `P4Client` (SPEC §4.4).

- [ ] **Step 1 — failing test:** construct `new P4Client(mock)`; assert
  `opened()` returns `OpenedFile[]` after an edit; `fstat` returns `isOpened`/
  `isTracked` correctly; `edit()` returns typed `OpenedFile[]`; `newChangelist("x")`
  returns a CL number string; a non-zero exit surfaces as `P4PilotError` with
  code `P4_COMMAND_FAILED`.
- [ ] **Step 2** — Run. Expected: FAIL.
- [ ] **Step 3** — Implement each method per SPEC §4.4: build args, `runner.run`,
  check `exitCode` (throw `P4PilotError` on non-zero using stderr), parse with
  `parseZtag`/`groupIndexed`, map to types. `newChangelist` feeds a change spec
  via `opts.input` and parses `Change NNNN created.` from stdout.
- [ ] **Step 4** — Run. Expected: PASS. Typecheck.
- [ ] **Step 5** — Commit: `feat(core): add typed P4Client wrapper`.

### Task 1.5: Asset guard

**Files:** Create `src/asset-guard.ts`; Test `test/asset-guard.test.ts`.
**Produces:** `classifyAsset`, `AssetClassification`, `AssetGuardConfig`,
`DEFAULT_ASSET_GUARD_CONFIG` (SPEC §4.5).

- [ ] **Step 1 — failing test:**

```ts
import { describe, it, expect } from "vitest";
import { classifyAsset } from "../src/asset-guard.js";

describe("classifyAsset", () => {
  it("flags .uasset as large-asset, shouldRead=false", () => {
    const c = classifyAsset("/ws/Content/Hero.uasset");
    expect(c.kind).toBe("large-asset");
    expect(c.shouldRead).toBe(false);
  });
  it("flags a text .cpp as text, shouldRead=true", () => {
    expect(classifyAsset("/ws/src/hero.cpp").shouldRead).toBe(true);
  });
  it("uses p4 filetype: binary+l => binary", () => {
    const c = classifyAsset("/ws/x.dat", { stat: { depotFile:"//x", isOpened:false, isTracked:true, headType:"binary+l" } as any });
    expect(c.kind).toBe("binary");
  });
  it("treats oversized text as binary", () => {
    expect(classifyAsset("/ws/big.json", { sizeBytes: 5_000_000 }).kind).toBe("binary");
  });
});
```

- [ ] **Step 2** — Run. Expected: FAIL.
- [ ] **Step 3** — Implement `classifyAsset` + default config (extension lists
  from SPEC §4.5) using the documented decision order.
- [ ] **Step 4** — Run. Expected: PASS. Typecheck.
- [ ] **Step 5** — Commit: `feat(core): add binary/large-asset guard`.

### Task 1.6: Auto-checkout (killer feature)

**Files:** Create `src/auto-checkout.ts`; Test `test/auto-checkout.test.ts`.
**Consumes:** `P4Client`, `classifyAsset`. **Produces:** `ensureOpenForEdit`,
`ensureOpenForEditMany`, `CheckoutResult`, `CheckoutStatus` (SPEC §4.6).

- [ ] **Step 1 — failing test** (drive through `P4Client` on `MockP4Runner`):
  - tracked+unopened file → status `"opened"`, and mock state shows it opened;
  - already-opened file → status `"already-open"`, no duplicate edit;
  - untracked new file → status `"added"`;
  - `.uasset` file → result includes `asset.kind === "large-asset"`;
  - `ensureOpenForEditMany` returns results in input order and one failing path
    doesn't abort the rest.
- [ ] **Step 2** — Run. Expected: FAIL.
- [ ] **Step 3** — Implement per SPEC §4.6 (fstat → branch on
  isOpened/isTracked → edit/add; attach changelist; classify asset).
- [ ] **Step 4** — Run. Expected: PASS. Typecheck.
- [ ] **Step 5** — Commit: `feat(core): add auto-checkout (ensureOpenForEdit)`.

### Task 1.7: Changelist helpers + config

**Files:** Create `src/changelist.ts`, `src/config.ts`; Tests
`test/config.test.ts` (+ changelist assertions).
**Produces:** `loadConfig`, `P4PilotConfig` (SPEC §4.8); a
`buildChangelistDescription(intent, prefix)` helper.

- [ ] **Step 1 — failing test:** `loadConfig` returns defaults when no file/env;
  `P4PILOT_MOCK=1` → `mock:true`; env `P4PORT` flows into `config.env.P4PORT`;
  a `.p4pilot.json` in `cwd` overrides `defaultChangelistPrefix`.
- [ ] **Step 2** — Run. Expected: FAIL.
- [ ] **Step 3** — Implement config merge (defaults < file < env) and the
  changelist description helper.
- [ ] **Step 4** — Run. Expected: PASS. Typecheck.
- [ ] **Step 5** — Commit: `feat(core): add config loader + changelist helpers`.

### Task 1.8: Core barrel + build gate

- [ ] **Step 1** — Finalize `src/index.ts` to export the full public API (SPEC
  §4.9); ensure `./testing` subpath exports `MockP4Runner` + fake-depot types.
- [ ] **Step 2** — `npm run build` in core. Expected: `dist/` with `.js`+`.d.ts`
  for both entries.
- [ ] **Step 3** — `npm test` (all core). Expected: green. `npm run typecheck` clean.
- [ ] **Step 4** — Commit: `chore(core): finalize public API + build`.

---

## Milestone 2 — `@p4pilot/mcp-server`

### Task 2.1: Server scaffold + stdio entry + `--mock`

**Files:** `packages/mcp-server/{package.json,tsconfig.json,tsup.config.ts}`,
`src/index.ts`, `src/server.ts`, `src/core-factory.ts`.
**Produces:** `createServer(core)`, `buildCore(argv, env)` → `{ client, config }`.

- [ ] **Step 1** — package.json: name `@p4pilot/mcp-server`, `bin` →
  `{ "p4pilot-mcp": "dist/index.js" }`, `type:module`, dep on `@p4pilot/core`
  (`workspace`/`*`), `@modelcontextprotocol/sdk`, `zod`; devDeps tsup/vitest/ts.
- [ ] **Step 2** — `core-factory.ts`: `buildCore` reads `--mock`/`P4PILOT_MOCK`;
  mock → `new P4Client(new MockP4Runner(loadMockDepot()))`; else
  `new P4Client(new ExecaP4Runner(...))`. `loadMockDepot()` reads bundled
  `examples/mock-depot.json`.
- [ ] **Step 3** — `server.ts`: `createServer(client, config)` builds an MCP
  `Server` from `@modelcontextprotocol/sdk`, registers tools (Task 2.2+), no
  transport yet. `index.ts`: parse argv, `buildCore`, connect
  `StdioServerTransport`. Add a shebang `#!/usr/bin/env node`.
- [ ] **Step 4** — typecheck clean. Commit:
  `chore(mcp): scaffold server, stdio entry, --mock factory`.

### Task 2.2: Tool registry + first tool `p4_status`

**Files:** `src/tools/index.ts`, `src/tools/status.ts`; Test `test/tools.test.ts`.
**Produces:** a `Tool` shape `{ name, description, inputSchema (zod), handler(client, args) }`
and a registry array.

- [ ] **Step 1 — failing test:** build core on a seeded `MockP4Runner`; call the
  `p4_status` handler; assert returned content lists the opened files / summary.
- [ ] **Step 2** — Run. Expected: FAIL.
- [ ] **Step 3** — Implement the `Tool` type, registry, and `p4_status`
  (`client.opened()` + count). Wire registry into `createServer` via
  `ListTools`/`CallTool` handlers, converting zod → JSON schema.
- [ ] **Step 4** — Run. Expected: PASS. Typecheck.
- [ ] **Step 5** — Commit: `feat(mcp): tool registry + p4_status`.

### Task 2.3: `p4_smart_edit` (+ edit/add/revert)

**Files:** `src/tools/smart-edit.ts`, `src/tools/basic-ops.ts`; extend test.
- [ ] **Step 1 — failing test:** `p4_smart_edit` with a tracked path opens it in
  the fake depot (assert `mock.state`); binary path returns a warning in content.
- [ ] **Step 2** — FAIL → **Step 3** implement using `ensureOpenForEditMany`;
  add `p4_edit`/`p4_add`/`p4_revert` thin wrappers. **Step 4** PASS + typecheck.
- [ ] **Step 5** — Commit: `feat(mcp): p4_smart_edit + edit/add/revert tools`.

### Task 2.4: Changelist tools (`create`, `list`, `describe`, `review`)

**Files:** `src/tools/changelist.ts`, `src/tools/review.ts`; extend test.
- [ ] **Step 1 — failing tests:** `p4_changelist_create` returns a CL number and
  prefixes the description; `p4_changelist_list` returns pending CLs; `p4_review`
  returns a files+diff summary from `describe(change,{diff:true})`.
- [ ] **Step 2–4** — FAIL → implement → PASS + typecheck.
- [ ] **Step 5** — Commit: `feat(mcp): changelist create/list/describe/review tools`.

### Task 2.5: `p4_asset_info`, `p4_search`, `p4_filelog`

**Files:** `src/tools/asset-info.ts`, `src/tools/search.ts`, `src/tools/filelog.ts`.
- [ ] **Step 1 — failing tests:** `p4_asset_info` on `.uasset` returns metadata +
  `shouldRead:false` and does NOT include file bytes; `p4_search` returns matches
  and skips binary files (seed a matching `.cpp` and a matching-name `.uasset`,
  assert only the `.cpp` hit); `p4_filelog` returns history entries. `p4_search`
  runs `rg`/`grep` via a runner injected for testability (mockable), so no real
  filesystem/tooling dependency in the unit test.
- [ ] **Step 2–4** — FAIL → implement → PASS + typecheck.
- [ ] **Step 5** — Commit: `feat(mcp): asset-info, search, filelog tools`.

### Task 2.6: In-memory integration test + error mapping + build

**Files:** `test/integration.test.ts`, `src/errors.ts`.
- [ ] **Step 1 — failing test:** use SDK `InMemoryTransport` to connect a client
  to `createServer(...)`; `listTools()` includes all §5.2 tools; `callTool(
  "p4_smart_edit", { paths:["/ws/a.c"] })` succeeds and the fake depot shows the
  file opened. Add a test that a `P4PilotError` becomes a tool error carrying its
  `code`.
- [ ] **Step 2–4** — FAIL → implement error mapping (§5.3) → PASS + typecheck.
- [ ] **Step 5** — `npm run build` (server). Commit:
  `feat(mcp): in-memory integration test, error mapping, build`.

---

## Milestone 3 — Star polish (see Task #4 in the tracker)

### Task 3.1: examples + `mock-depot.json`
- [ ] `examples/mock-depot.json` (a believable game-repo fake depot: a few `.cpp`,
  a `.uasset`, a `.fbx`, one pending changelist).
- [ ] `examples/claude-code.md`, `examples/cursor.mcp.json`,
  `examples/codex.config.toml` — copy-pasteable, matching shipped flags/names.
- [ ] Commit: `docs(examples): mock depot + agent config snippets`.

### Task 3.2: CI + badges
- [ ] `.github/workflows/ci.yml`: matrix Node 20/22, steps `npm ci`,
  `npm run typecheck`, `npm test`, `npm run build`. No Perforce.
- [ ] Update README CI/npm badges to the real URLs.
- [ ] Commit: `ci: add GitHub Actions (typecheck, test, build)`.

### Task 3.3: tool reference + architecture docs
- [ ] `docs/TOOLS.md` (one section per tool: input, output, example).
- [ ] `docs/ARCHITECTURE.md` (the SPEC diagram + data-flow prose).
- [ ] Verify README quickstart against acceptance criteria (SPEC §7).
- [ ] Commit: `docs: tool reference + architecture`.

---

## Self-review checklist (run after Milestone 2)

- [ ] Every SPEC §4 public function has a direct test.
- [ ] No `TODO`/stub bodies; no real-`p4` calls in tests.
- [ ] Type/name consistency: tool names in README == server registry == SPEC §5.2.
- [ ] `npm install && npm run typecheck && npm test && npm run build` green with
  no Perforce installed (SPEC §7.1).

## Discovered follow-ups

_(Agents: append out-of-scope findings here instead of implementing them.)_
