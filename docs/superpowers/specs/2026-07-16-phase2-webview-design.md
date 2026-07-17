# Phase 2 — p4pilot Web Panel (design)

**Date:** 2026-07-16 **Status:** approved design, ready for implementation plan
**Depends on:** MVP (`@p4pilot/core`, `@p4pilot/mcp-server`) shipped at v0.1.0.

## 1. Goal

Ship a **clickable, zero-install web demo** of p4pilot that a hiring reviewer
(target: miHoYo coding-agent role) can open from a URL and interact with — the
Phase 2 "React WebView panel (changelist dashboard + review UI)" from the
roadmap, delivered first as a **standalone static site**.

The demo runs **the real `@p4pilot/core` engine in the browser**, driving an
in-memory fake depot (`MockP4Runner`). No backend, no Perforce, no install.

**Why this shape:** it maximizes showcase impact (a link, not a clone), reuses
production code (not a toy re-implementation), and continues the MVP's
mock-first, fully-offline approach.

## 2. Non-goals (YAGNI)

- Connecting to a real Perforce server from the browser (impossible/undesired).
- `p4 submit`, authentication, multi-workspace switching.
- Real UE / Maya / PC-client embedding. The app is a plain static React bundle,
  so it is *embeddable by construction*, but wiring it into those hosts is a
  follow-up, not this deliverable.
- Depot search UI (optional stretch, not in MVP).

## 3. Architecture

### 3.1 Package layout

A new workspace package **`packages/web`** (`@p4pilot/web`, `private: true`,
never published):

```
packages/web/
  package.json         # @p4pilot/web, deps: react, react-dom, @p4pilot/core (workspace *)
  vite.config.ts       # base "/p4pilot/"; @vitejs/plugin-react; vitest (jsdom) config
  index.html
  src/
    main.tsx           # React root
    App.tsx            # layout: header + two views (tabs or split)
    demo/
      seed.ts          # richer demo depot (files WITH before/after content for diffs)
      store.ts         # DemoStore: wraps new P4Client(new MockP4Runner(seed)); tool-mirroring methods
      useDemo.ts       # React hook/context exposing store state + actions
    diff.ts            # tiny unified-diff renderer input (line diff)
    components/
      Header.tsx
      Dashboard.tsx    # view 1
      FileList.tsx  FileRow.tsx  AssetInfoCard.tsx  ChangelistList.tsx
      ReviewView.tsx   # view 2
      DiffView.tsx
  test/                # or colocated *.test.ts(x)
```

### 3.2 core refactor (minimal, additive — verified)

`p4-client.ts` and `testing/mock-runner.ts` import `P4Runner`/`P4Result`/
`P4RunOptions` as **`import type`** (erased at compile), so they carry **no
runtime `execa` dependency**. The only Node dependencies in the modules the web
app needs are: (a) the barrel `index.ts` re-exporting `p4-runner` (execa) and
`config` (`node:fs`, `process`); (b) `mock-runner.ts`'s `node:path` (`posix`).

Two additive/low-risk changes:

1. **New browser barrel `packages/core/src/browser.ts`** — re-exports only the
   browser-safe surface, deliberately omitting `p4-runner` and `config`:

   ```ts
   // Browser-safe subset of @p4pilot/core (no execa, no node:fs, no process).
   export * from "./types.js";
   export * from "./ztag.js";
   export * from "./p4-client.js";
   export * from "./asset-guard.js";
   export * from "./auto-checkout.js";
   export * from "./changelist.js";
   export { MockP4Runner } from "./testing/mock-runner.js";
   export type { FakeDepotState, FakeFile } from "./testing/mock-runner.js";
   export type { P4Runner, P4Result, P4RunOptions } from "./p4-runner.js"; // type-only, erased
   ```

2. **De-Node `mock-runner.ts`** — replace the `node:path` `posix.join`/
   `posix.dirname` usages with 3-line local pure-string helpers, removing the
   last Node import. (Fallback if this proves fiddly: alias `node:path` →
   `path-browserify` in the web app's Vite config; prefer the de-Node change so
   `MockP4Runner` is genuinely portable.)

Wiring: add `src/browser.ts` as a `tsup` entry and a `package.json` export:

```jsonc
"./browser": {
  "types": "./dist/browser.d.ts",
  "import": "./dist/browser.js",
  "require": "./dist/browser.cjs"
}
```

The main entry `.` is unchanged, so **`@p4pilot/mcp-server` is unaffected and
core's 46 tests must stay green** (verified immediately after the refactor).

### 3.3 Data flow (browser-only)

```
React components
  → useDemo() hook  → DemoStore
                        → new P4Client(new MockP4Runner(seed))   // real core
                        → in-memory fake depot mutates
  → store emits new state → React re-renders
```

Refresh resets to the seed. Same engine as production; only the runner is the
mock. `DemoStore` exposes methods that mirror the MCP tools 1:1
(`status`, `smartEdit`, `edit`, `revert`, `createChangelist`, `listChangelists`,
`describe`, `review`, `assetInfo`) so the UI story maps directly to the tools.

## 4. Features (MVP — the two roadmap views)

### View 1 — Workspace Dashboard

- **File list**: each depot file with an **asset badge** (`text` / `binary` /
  `large-asset`, from `classifyAsset`) and an "opened" indicator.
- **Smart checkout** action per file → `ensureOpenForEdit` into a chosen
  changelist; shows resulting status and a ⚠ warning for binary/large assets.
- **Opened-files summary** (mirrors `p4_status`).
- **Changelists**: list pending CLs; **create CL** (description auto-prefixed
  with `[p4pilot] `, via `buildChangelistDescription`).
- Clicking a binary/large asset opens an **AssetInfoCard**: metadata + the
  "content withheld — act on metadata, do not read bytes" note (showcases the
  asset guard).

### View 2 — Changelist Review ("PR review for Perforce")

- Pick a pending changelist → file list (action + depot path) from
  `P4Client.describe`, plus a **real unified diff** per changed file.
- **Diff source:** core's mock has no file contents, so the *web demo seed*
  carries `before`/`after` text per changed file; `DiffView` computes and renders
  the unified diff in-browser (line adds/removes colored). This is honest — the
  structure/metadata come from real core; only the file contents are demo seed.

### Header

A one-line banner: *"Running the real `@p4pilot/core` engine in your browser —
mock depot, no server."* plus a link back to the GitHub repo.

## 5. Deploy

- **GitHub Pages** via a new workflow `.github/workflows/pages.yml`: build
  `packages/web` (`npm ci` at root, `npm run build -w @p4pilot/web`), upload
  `packages/web/dist`, deploy with the official Pages actions. Triggers on push
  to `main` (and manual `workflow_dispatch`).
- Vite `base: "/p4pilot/"` so asset URLs resolve at `sdvgdfvds.github.io/p4pilot/`.
- README gets a **Live Demo** badge/link at the top.

## 6. Testing

- **Core:** the 46 existing tests must stay green after the refactor (run
  immediately). Add one test asserting the browser barrel imports with no Node
  built-ins pulled (e.g. import `@p4pilot/core/browser`, construct
  `new P4Client(new MockP4Runner(seed))`, run a checkout — all without `node:*`).
- **Web:** Vitest + `@testing-library/react` + `jsdom`.
  - `DemoStore` unit tests: create CL, smart-checkout (state shows file opened in
    the CL), revert, asset classification, review returns files + a non-empty diff.
  - Component render tests: Dashboard lists files with correct badges; clicking a
    binary asset renders the withheld-content card; ReviewView renders diff hunks.
- Environment split: core/mcp-server tests run in Node; web component tests need
  `jsdom`. Handle with either per-file `// @vitest-environment jsdom` directives
  or a `vitest.workspace.ts` defining node vs jsdom projects, so a single root
  `vitest run` stays green across all packages.
- CI: extend the existing offline principle — the Pages workflow runs `npm ci` +
  build; web tests run under the root `npm test` alongside the existing suites.

## 7. Tech stack

- Vite + React 18 + TypeScript (strict, ESM) — matches the repo's TS/ESM stance.
- Unified diff: a tiny hand-rolled line differ, or the small `diff` package.
- Styling / visual polish: applied during implementation via the
  **frontend-design** skill (the showcase bar is high; the design doc fixes
  scope and structure, not pixels).

## 8. Acceptance criteria

1. After the core refactor, `npm run typecheck && npm test && npm run build`
   are green (core still 46, mcp-server unaffected).
2. `@p4pilot/core/browser` bundles for the browser with **no Node polyfills**
   (no execa / node:fs / node:path in the browser graph).
3. `packages/web`: `npm run dev` serves the app; dashboard shows files + asset
   badges; smart-checkout opens a file into a CL and the UI updates; create-CL
   works; ReviewView shows a real unified diff; binary asset shows withheld card.
4. `packages/web` builds to static assets and deploys to GitHub Pages; the README
   Live Demo link opens the working app.
5. Web tests green under `npm test`.

## 9. Follow-ups (post-MVP)

- Real-Perforce mode (via the MCP server or a thin backend) so the same UI drives
  a live depot.
- Embedding shells for UE / Maya / PC-client WebViews (JD item 5).
- Depot search UI (`p4_search`); shelved-changelist review.
