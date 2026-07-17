# Phase 2 Web Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a zero-install, in-browser p4pilot demo (React static site) that drives the real `@p4pilot/core` engine over an in-memory fake depot, with a changelist dashboard and a changelist-review (diff) view, deployed to GitHub Pages.

**Architecture:** New `packages/web` (Vite + React + TS) imports a new browser-safe core entry `@p4pilot/core/browser` (no execa/fs). A `DemoStore` wraps `new P4Client(new MockP4Runner(seed))`; React renders its state and mutates the fake depot live. A web-level seed supplies file before/after text so the review view renders a real unified diff.

**Tech Stack:** TypeScript (strict, ESM), React 18, Vite 5, Vitest + @testing-library/react + jsdom, the `diff` package, npm workspaces, GitHub Actions (Pages).

## Global Constraints

- ESM only (`"type": "module"`), strict TS incl. `noUncheckedIndexedAccess`. (verbatim from repo)
- Node ≥ 20. Package manager: npm workspaces (no pnpm).
- Tests never touch a real Perforce server or the real `p4` binary — only `MockP4Runner`.
- The core **main** entry (`.`) and `./testing` must stay unchanged in behavior; `@p4pilot/mcp-server` must keep working and core's existing **46 tests must stay green**.
- Conventional-commit messages (`feat:`/`fix:`/`test:`/`docs:`/`chore:`/`ci:`). Small, frequent commits.
- New browser code must not import `execa`, `node:fs`, `node:path`, or `process`.
- `@p4pilot/web` is `private: true` (never published to npm).

---

## File Structure

**Modified in core:**
- `packages/core/src/testing/mock-runner.ts` — drop `node:path`; add a pure `relativePosix` helper.
- `packages/core/src/browser.ts` — **new** browser-safe barrel (no execa/fs).
- `packages/core/tsup.config.ts` — add `src/browser.ts` entry.
- `packages/core/package.json` — add `./browser` export.
- `packages/core/test/browser.test.ts` — **new** test proving the browser barrel drives a checkout.

**New `packages/web`:**
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/main.tsx`, `src/App.tsx`, `src/styles.css`
- `src/demo/seed.ts` — `DemoSeed` (depot + file contents)
- `src/demo/store.ts` — `DemoStore` (tool-mirroring methods over core)
- `src/demo/useDemo.tsx` — React context/hook (state + actions)
- `src/diff.ts` — `toDiffRows(before, after)`
- `src/components/Header.tsx`, `Dashboard.tsx`, `FileRow.tsx`, `AssetInfoCard.tsx`, `ChangelistList.tsx`, `ReviewView.tsx`, `DiffView.tsx`
- Tests colocated as `*.test.ts(x)` under `src/`
- `.github/workflows/pages.yml` — build + deploy to Pages
- `README.md` — add Live Demo link

**Vitest environment:** web component tests declare `// @vitest-environment jsdom` at the top of each `*.test.tsx` file; core/server tests stay on the default node environment. A single root `vitest run` covers all packages.

---

## Task 1: Make `@p4pilot/core` browser-consumable

**Files:**
- Modify: `packages/core/src/testing/mock-runner.ts`
- Create: `packages/core/src/browser.ts`
- Modify: `packages/core/tsup.config.ts`
- Modify: `packages/core/package.json`
- Test: `packages/core/test/browser.test.ts`

**Interfaces:**
- Consumes: existing `P4Client`, `MockP4Runner`, `ensureOpenForEditMany`, `classifyAsset`, `buildChangelistDescription`, types.
- Produces: subpath import `@p4pilot/core/browser` exporting all of the above **without** any Node dependency.

- [ ] **Step 1: De-Node `mock-runner.ts`.** Replace the first import line and the `posix.relative` calls.

Replace line 1:
```ts
import { posix } from "node:path";
```
with (delete the import entirely; add this helper near the other module-level helpers, e.g. after `normalizePath`):
```ts
/** Pure POSIX `path.relative` for absolute, normalized paths (no node:path). */
function relativePosix(from: string, to: string): string {
  const fromParts = from.replace(/\/+$/, "").split("/").filter(Boolean);
  const toParts = to.split("/").filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i += 1;
  const up = fromParts.slice(i).map(() => "..");
  return [...up, ...toParts.slice(i)].join("/");
}
```
In `toDepotFile`, replace both `posix.relative(` calls with `relativePosix(`:
```ts
const relative = relativePosix(normalizedRoot, clientFile);
```
```ts
const trackedRelative = relativePosix(normalizedRoot, normalizePath(trackedFile.clientFile));
```

- [ ] **Step 2: Run core tests to confirm no regression.**

Run: `npm test -w @p4pilot/core`
Expected: PASS (34 core tests, including `mock-runner.test.ts`).

- [ ] **Step 3: Create the browser barrel `packages/core/src/browser.ts`.**

```ts
// Browser-safe subset of @p4pilot/core: no execa, no node:fs, no node:path, no process.
// Deliberately omits ./p4-runner (execa) and ./config (node:fs) at runtime.
export * from "./types.js";
export * from "./ztag.js";
export * from "./p4-client.js";
export * from "./asset-guard.js";
export * from "./auto-checkout.js";
export * from "./changelist.js";
export { MockP4Runner } from "./testing/mock-runner.js";
export type { FakeDepotState, FakeFile } from "./testing/mock-runner.js";
export type { P4Runner, P4Result, P4RunOptions } from "./p4-runner.js"; // type-only → erased
```

- [ ] **Step 4: Add the tsup entry.** In `packages/core/tsup.config.ts`, change the `entry` array to:
```ts
  entry: ["src/index.ts", "src/testing/mock-runner.ts", "src/browser.ts"],
```

- [ ] **Step 5: Add the package export.** In `packages/core/package.json`, add a `"./browser"` key to `exports` (after `"./testing"`):
```jsonc
    "./browser": {
      "types": "./dist/browser.d.ts",
      "import": "./dist/browser.js",
      "require": "./dist/browser.cjs"
    }
```

- [ ] **Step 6: Write the failing browser-barrel test `packages/core/test/browser.test.ts`.**

```ts
import { describe, expect, it } from "vitest";
import { MockP4Runner, P4Client, classifyAsset } from "../src/browser.js";

const seed = () =>
  new MockP4Runner({
    root: "/ws",
    user: "u",
    client: "c",
    files: [{ depotFile: "//depot/a.cpp", clientFile: "/ws/a.cpp", headType: "text", headRev: 1 }],
    changelists: [],
  });

describe("@p4pilot/core/browser", () => {
  it("drives a checkout through P4Client without Node deps", async () => {
    const client = new P4Client(seed());
    const opened = await client.edit(["/ws/a.cpp"]);
    expect(opened[0]!.depotFile).toBe("//depot/a.cpp");
  });

  it("classifies assets", () => {
    expect(classifyAsset("/ws/Hero.uasset").shouldRead).toBe(false);
  });
});
```

- [ ] **Step 7: Run it.** Run: `npm test -w @p4pilot/core -- browser`
Expected: PASS.

- [ ] **Step 8: Build core, verify browser artifacts.** Run: `npm run build -w @p4pilot/core`
Expected: `dist/browser.js`, `dist/browser.cjs`, `dist/browser.d.ts` present. Then `npm run typecheck` (root) — clean.

- [ ] **Step 9: Commit.**
```bash
git add packages/core
git commit -m "feat(core): add browser-safe entry (@p4pilot/core/browser)"
```

---

## Task 2: Scaffold `packages/web`

**Files:**
- Create: `packages/web/package.json`, `packages/web/tsconfig.json`, `packages/web/vite.config.ts`, `packages/web/index.html`, `packages/web/src/main.tsx`, `packages/web/src/App.tsx`, `packages/web/src/styles.css`
- Test: `packages/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `@p4pilot/core/browser` (requires Task 1 built it: `npm run build -w @p4pilot/core`).
- Produces: a runnable Vite app; `App` React component; the Vitest/jsdom harness for later tasks.

- [ ] **Step 1: `packages/web/package.json`.**
```json
{
  "name": "@p4pilot/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc"
  },
  "dependencies": {
    "@p4pilot/core": "*",
    "diff": "^7.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/diff": "^7.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^4.1.0"
  }
}
```

- [ ] **Step 2: `packages/web/tsconfig.json`.**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: `packages/web/vite.config.ts`.**
```ts
/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/p4pilot/",
  plugins: [react()],
  test: {
    globals: true,
    environment: "node", // per-file `// @vitest-environment jsdom` for component tests
  },
});
```

- [ ] **Step 4: `packages/web/index.html`.**
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>p4pilot — Perforce-native layer for AI agents (demo)</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: `packages/web/src/styles.css`** (minimal; frontend-design refines later).
```css
:root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
body { margin: 0; }
.badge { padding: 0 6px; border-radius: 6px; font-size: 12px; }
.badge.text { background: #e6f4ea; }
.badge.binary { background: #fde7e9; }
.badge.large-asset { background: #fff4ce; }
.diff .add { background: #e6ffed; }
.diff .del { background: #ffeef0; }
```

- [ ] **Step 6: `packages/web/src/App.tsx`** (placeholder shell; filled in Task 9).
```tsx
export function App() {
  return <main data-testid="app">p4pilot demo</main>;
}
```

- [ ] **Step 7: `packages/web/src/main.tsx`.**
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Install deps.** Run: `npm install`
Expected: `@p4pilot/web` linked into the workspace.

- [ ] **Step 9: Write `packages/web/src/App.test.tsx`.**
```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("App", () => {
  it("renders", () => {
    render(<App />);
    expect(screen.getByTestId("app")).toBeDefined();
  });
});
```

- [ ] **Step 10: Run web tests + dev build.**
Run: `npm test -w @p4pilot/web` → PASS.
Run: `npm run build -w @p4pilot/web` → produces `packages/web/dist`.

- [ ] **Step 11: Commit.**
```bash
git add packages/web package-lock.json
git commit -m "feat(web): scaffold Vite + React + TS package"
```

---

## Task 3: Demo seed data

**Files:**
- Create: `packages/web/src/demo/seed.ts`
- Test: `packages/web/src/demo/seed.test.ts`

**Interfaces:**
- Produces: `DemoSeed = { depot: FakeDepotState; contents: Record<string, { before: string; after: string }> }` and `makeSeed(): DemoSeed` (a fresh copy each call).

- [ ] **Step 1: Write `packages/web/src/demo/seed.ts`.**
```ts
import type { FakeDepotState } from "@p4pilot/core/browser";

export interface DemoSeed {
  depot: FakeDepotState;
  /** depotFile -> before/after text, so the review view can render a real diff. */
  contents: Record<string, { before: string; after: string }>;
}

export function makeSeed(): DemoSeed {
  const depot: FakeDepotState = {
    root: "/depot/game",
    port: "ssl:perforce.example.com:1666",
    client: "p4pilot-demo",
    user: "demo",
    files: [
      { depotFile: "//depot/game/src/main.cpp", clientFile: "/depot/game/src/main.cpp", headType: "text", headRev: 4, sizeBytes: 2200 },
      { depotFile: "//depot/game/src/player.cpp", clientFile: "/depot/game/src/player.cpp", headType: "text", headRev: 7, sizeBytes: 5400 },
      { depotFile: "//depot/game/Content/Hero.uasset", clientFile: "/depot/game/Content/Hero.uasset", headType: "binary+l", headRev: 3, sizeBytes: 4_200_000 },
      { depotFile: "//depot/game/Art/hero_mesh.fbx", clientFile: "/depot/game/Art/hero_mesh.fbx", headType: "binary", headRev: 2, sizeBytes: 8_800_000 },
    ],
    changelists: [
      { change: "812", description: "wip: player dash ability", status: "pending", user: "demo", client: "p4pilot-demo", files: ["//depot/game/src/player.cpp"] },
    ],
  };
  const contents: DemoSeed["contents"] = {
    "//depot/game/src/player.cpp": {
      before: "void Player::Update(float dt) {\n  Move(dt);\n}\n",
      after: "void Player::Update(float dt) {\n  Move(dt);\n  if (input.Pressed(Dash)) {\n    StartDash();\n  }\n}\n",
    },
  };
  return { depot, contents };
}
```

- [ ] **Step 2: Write `packages/web/src/demo/seed.test.ts`.**
```ts
import { describe, expect, it } from "vitest";
import { makeSeed } from "./seed.js";

describe("makeSeed", () => {
  it("has the four demo files and one pending changelist", () => {
    const s = makeSeed();
    expect(s.depot.files).toHaveLength(4);
    expect(s.depot.changelists?.[0]!.change).toBe("812");
  });
  it("returns a fresh copy each call (no shared mutation)", () => {
    expect(makeSeed().depot).not.toBe(makeSeed().depot);
  });
  it("carries before/after content for the changed file", () => {
    expect(makeSeed().contents["//depot/game/src/player.cpp"]!.after).toContain("StartDash");
  });
});
```

- [ ] **Step 3: Run.** `npm test -w @p4pilot/web -- seed` → PASS.

- [ ] **Step 4: Commit.**
```bash
git add packages/web/src/demo/seed.ts packages/web/src/demo/seed.test.ts
git commit -m "feat(web): add in-browser demo depot seed"
```

---

## Task 4: `DemoStore` (tool-mirroring core wrapper)

**Files:**
- Create: `packages/web/src/demo/store.ts`
- Test: `packages/web/src/demo/store.test.ts`

**Interfaces:**
- Consumes: `makeSeed` (Task 3), `toDiffRows` (Task 5 — import added in Step for review; if implementing in order, stub review's diff by returning rows from Task 5). To avoid a forward dependency, **Task 5 is implemented before this task's `review` method is tested**; build order: Task 3 → Task 5 → Task 4. (Kept numbered for readability.)
- Produces:
  ```ts
  interface FileView { depotFile: string; clientFile: string; kind: AssetKind; shouldRead: boolean; opened: boolean; action?: string; change?: string; headRev?: number }
  interface ReviewData { change: string; description: string; user?: string; files: { depotFile: string; action: string; rows: DiffRow[] }[] }
  class DemoStore {
    constructor();                                   // builds P4Client over a fresh MockP4Runner(makeSeed().depot)
    listFiles(): Promise<FileView[]>;
    smartEdit(clientFile: string, changelist?: string): Promise<CheckoutResult>;
    createChangelist(description: string): Promise<string>;
    listChangelists(): Promise<ChangelistSummary[]>;
    revert(clientFile: string): Promise<string[]>;
    assetInfo(path: string): Promise<{ path: string; kind: AssetKind; filetype?: string; tracked: boolean; headRev?: number; shouldRead: boolean; reason: string }>;
    review(change: string): Promise<ReviewData>;
  }
  ```

- [ ] **Step 1: Write `packages/web/src/demo/store.ts`.**
```ts
import {
  buildChangelistDescription,
  classifyAsset,
  ensureOpenForEditMany,
  MockP4Runner,
  P4Client,
  type AssetKind,
  type ChangelistSummary,
  type CheckoutResult,
} from "@p4pilot/core/browser";
import { toDiffRows, type DiffRow } from "../diff.js";
import { makeSeed, type DemoSeed } from "./seed.js";

export interface FileView {
  depotFile: string;
  clientFile: string;
  kind: AssetKind;
  shouldRead: boolean;
  opened: boolean;
  action?: string;
  change?: string;
  headRev?: number;
}

export interface ReviewData {
  change: string;
  description: string;
  user?: string;
  files: { depotFile: string; action: string; rows: DiffRow[] }[];
}

export class DemoStore {
  readonly #seed: DemoSeed;
  readonly #client: P4Client;

  constructor() {
    this.#seed = makeSeed();
    this.#client = new P4Client(new MockP4Runner(this.#seed.depot));
  }

  async listFiles(): Promise<FileView[]> {
    const stats = await this.#client.fstat(this.#seed.depot.files.map((f) => f.clientFile));
    return stats.map((stat) => {
      const path = stat.clientFile ?? stat.depotFile;
      const asset = classifyAsset(path, { stat });
      return {
        depotFile: stat.depotFile,
        clientFile: stat.clientFile ?? stat.depotFile,
        kind: asset.kind,
        shouldRead: asset.shouldRead,
        opened: stat.isOpened,
        action: stat.action,
        change: stat.isOpened ? this.#openedChange(stat.depotFile) : undefined,
        headRev: stat.headRev,
      };
    });
  }

  async smartEdit(clientFile: string, changelist?: string): Promise<CheckoutResult> {
    const [result] = await ensureOpenForEditMany(
      this.#client,
      [clientFile],
      changelist === undefined ? undefined : { changelist },
    );
    return result!;
  }

  async createChangelist(description: string): Promise<string> {
    return this.#client.newChangelist(buildChangelistDescription(description, "[p4pilot] "));
  }

  async listChangelists(): Promise<ChangelistSummary[]> {
    return this.#client.changes({ status: "pending" });
  }

  async revert(clientFile: string): Promise<string[]> {
    return this.#client.revert([clientFile]);
  }

  async assetInfo(path: string) {
    const [stat] = await this.#client.fstat([path]);
    const asset = classifyAsset(path, { stat });
    return {
      path,
      kind: asset.kind,
      filetype: asset.filetype,
      tracked: stat?.isTracked ?? false,
      headRev: stat?.headRev,
      shouldRead: asset.shouldRead,
      reason: asset.reason,
    };
  }

  async review(change: string): Promise<ReviewData> {
    const described = await this.#client.describe(change, { diff: true });
    return {
      change: described.change,
      description: described.description,
      user: described.user,
      files: described.files.map((file) => {
        const content = this.#seed.contents[file.depotFile];
        return {
          depotFile: file.depotFile,
          action: file.action,
          rows: content ? toDiffRows(content.before, content.after) : [],
        };
      }),
    };
  }

  #openedChange(depotFile: string): string | undefined {
    return this.#seed.depot.files.find((f) => f.depotFile === depotFile)?.opened?.change;
  }
}
```

- [ ] **Step 2: Write `packages/web/src/demo/store.test.ts`.**
```ts
import { describe, expect, it } from "vitest";
import { DemoStore } from "./store.js";

describe("DemoStore", () => {
  it("lists four files with asset kinds", async () => {
    const files = await new DemoStore().listFiles();
    expect(files).toHaveLength(4);
    expect(files.find((f) => f.clientFile.endsWith("Hero.uasset"))!.kind).toBe("large-asset");
  });

  it("smart-edit opens a file", async () => {
    const store = new DemoStore();
    const result = await store.smartEdit("/depot/game/src/main.cpp");
    expect(result.status).toBe("opened");
    const files = await store.listFiles();
    expect(files.find((f) => f.clientFile.endsWith("main.cpp"))!.opened).toBe(true);
  });

  it("smart-edit flags a large asset", async () => {
    const result = await new DemoStore().smartEdit("/depot/game/Content/Hero.uasset");
    expect(result.asset?.shouldRead).toBe(false);
  });

  it("creates a prefixed changelist", async () => {
    const store = new DemoStore();
    const change = await store.createChangelist("dash tuning");
    const cls = await store.listChangelists();
    expect(cls.find((c) => c.change === change)!.description).toContain("[p4pilot] dash tuning");
  });

  it("review returns a non-empty diff for the seeded file", async () => {
    const review = await new DemoStore().review("812");
    const file = review.files.find((f) => f.depotFile.endsWith("player.cpp"))!;
    expect(file.rows.some((r) => r.type === "add")).toBe(true);
  });
});
```

- [ ] **Step 3: Run.** `npm test -w @p4pilot/web -- store` → PASS.

- [ ] **Step 4: Commit.**
```bash
git add packages/web/src/demo/store.ts packages/web/src/demo/store.test.ts
git commit -m "feat(web): DemoStore mirroring MCP tools over in-browser core"
```

---

## Task 5: Unified-diff util (implement before Task 4's review test)

**Files:**
- Create: `packages/web/src/diff.ts`
- Test: `packages/web/src/diff.test.ts`

**Interfaces:**
- Consumes: `diffLines` from the `diff` package.
- Produces: `type DiffRow = { type: "add" | "del" | "ctx"; text: string }` and `toDiffRows(before: string, after: string): DiffRow[]`.

- [ ] **Step 1: Write `packages/web/src/diff.ts`.**
```ts
import { diffLines } from "diff";

export interface DiffRow {
  type: "add" | "del" | "ctx";
  text: string;
}

export function toDiffRows(before: string, after: string): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const part of diffLines(before, after)) {
    const type: DiffRow["type"] = part.added ? "add" : part.removed ? "del" : "ctx";
    for (const line of part.value.split("\n")) {
      if (line.length > 0) rows.push({ type, text: line });
    }
  }
  return rows;
}
```

- [ ] **Step 2: Write `packages/web/src/diff.test.ts`.**
```ts
import { describe, expect, it } from "vitest";
import { toDiffRows } from "./diff.js";

describe("toDiffRows", () => {
  it("marks added lines", () => {
    const rows = toDiffRows("a\nb\n", "a\nb\nc\n");
    expect(rows.find((r) => r.text === "c")!.type).toBe("add");
  });
  it("marks removed lines", () => {
    const rows = toDiffRows("a\nb\n", "a\n");
    expect(rows.find((r) => r.text === "b")!.type).toBe("del");
  });
});
```

- [ ] **Step 3: Run.** `npm test -w @p4pilot/web -- diff` → PASS.

- [ ] **Step 4: Commit.**
```bash
git add packages/web/src/diff.ts packages/web/src/diff.test.ts
git commit -m "feat(web): line-diff helper for the review view"
```

---

## Task 6: `useDemo` React context/hook

**Files:**
- Create: `packages/web/src/demo/useDemo.tsx`
- Test: `packages/web/src/demo/useDemo.test.tsx`

**Interfaces:**
- Consumes: `DemoStore`, `FileView`, `ChangelistSummary`.
- Produces: `DemoProvider` component and `useDemo()` returning
  ```ts
  {
    files: FileView[];
    changelists: ChangelistSummary[];
    ready: boolean;
    smartEdit(clientFile: string, changelist?: string): Promise<void>;
    createChangelist(description: string): Promise<void>;
    revert(clientFile: string): Promise<void>;
    store: DemoStore;
  }
  ```
  Actions mutate the depot then refresh `files`/`changelists`.

- [ ] **Step 1: Write `packages/web/src/demo/useDemo.tsx`.**
```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ChangelistSummary } from "@p4pilot/core/browser";
import { DemoStore, type FileView } from "./store.js";

interface DemoContextValue {
  files: FileView[];
  changelists: ChangelistSummary[];
  ready: boolean;
  smartEdit: (clientFile: string, changelist?: string) => Promise<void>;
  createChangelist: (description: string) => Promise<void>;
  revert: (clientFile: string) => Promise<void>;
  store: DemoStore;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => new DemoStore(), []);
  const [files, setFiles] = useState<FileView[]>([]);
  const [changelists, setChangelists] = useState<ChangelistSummary[]>([]);
  const [ready, setReady] = useState(false);

  async function refresh() {
    setFiles(await store.listFiles());
    setChangelists(await store.listChangelists());
    setReady(true);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: DemoContextValue = {
    files,
    changelists,
    ready,
    store,
    smartEdit: async (clientFile, changelist) => {
      await store.smartEdit(clientFile, changelist);
      await refresh();
    },
    createChangelist: async (description) => {
      await store.createChangelist(description);
      await refresh();
    },
    revert: async (clientFile) => {
      await store.revert(clientFile);
      await refresh();
    },
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (ctx === null) throw new Error("useDemo must be used within a DemoProvider");
  return ctx;
}
```

- [ ] **Step 2: Write `packages/web/src/demo/useDemo.test.tsx`.**
```tsx
// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoProvider, useDemo } from "./useDemo.js";

function Probe() {
  const { files, ready, smartEdit } = useDemo();
  return (
    <div>
      <span data-testid="count">{ready ? files.length : -1}</span>
      <span data-testid="opened">{files.filter((f) => f.opened).length}</span>
      <button onClick={() => void smartEdit("/depot/game/src/main.cpp")}>edit</button>
    </div>
  );
}

describe("useDemo", () => {
  it("loads files and reflects a checkout", async () => {
    render(
      <DemoProvider>
        <Probe />
      </DemoProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("4"));
    await act(async () => {
      screen.getByText("edit").click();
    });
    await waitFor(() => expect(screen.getByTestId("opened").textContent).toBe("1"));
  });
});
```

- [ ] **Step 3: Run.** `npm test -w @p4pilot/web -- useDemo` → PASS.

- [ ] **Step 4: Commit.**
```bash
git add packages/web/src/demo/useDemo.tsx packages/web/src/demo/useDemo.test.tsx
git commit -m "feat(web): useDemo context (state + actions over DemoStore)"
```

---

## Task 7: Dashboard view + components

**Files:**
- Create: `packages/web/src/components/FileRow.tsx`, `AssetInfoCard.tsx`, `ChangelistList.tsx`, `Dashboard.tsx`
- Test: `packages/web/src/components/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `useDemo`, `FileView`, `DemoStore.assetInfo`.
- Produces: `Dashboard` component (default export not used; named export `Dashboard`).

- [ ] **Step 1: `packages/web/src/components/FileRow.tsx`.**
```tsx
import type { FileView } from "../demo/store.js";

export function FileRow({ file, onCheckout, onInspect }: {
  file: FileView;
  onCheckout: (clientFile: string) => void;
  onInspect: (clientFile: string) => void;
}) {
  return (
    <tr>
      <td><span className={`badge ${file.kind}`}>{file.kind}</span></td>
      <td>{file.depotFile}</td>
      <td>{file.opened ? `${file.action} @ ${file.change}` : "—"}</td>
      <td>
        <button onClick={() => onCheckout(file.clientFile)} disabled={file.opened}>Smart checkout</button>
        {!file.shouldRead && <button onClick={() => onInspect(file.clientFile)}>Asset info</button>}
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: `packages/web/src/components/AssetInfoCard.tsx`.**
```tsx
export interface AssetInfo {
  path: string; kind: string; filetype?: string; tracked: boolean; headRev?: number; shouldRead: boolean; reason: string;
}

export function AssetInfoCard({ info, onClose }: { info: AssetInfo; onClose: () => void }) {
  return (
    <aside data-testid="asset-info">
      <button onClick={onClose}>close</button>
      <dl>
        <dt>path</dt><dd>{info.path}</dd>
        <dt>kind</dt><dd>{info.kind}</dd>
        <dt>filetype</dt><dd>{info.filetype ?? "unknown"}</dd>
        <dt>headRev</dt><dd>{info.headRev ?? "-"}</dd>
        <dt>shouldRead</dt><dd>{String(info.shouldRead)}</dd>
        <dt>reason</dt><dd>{info.reason}</dd>
      </dl>
      {!info.shouldRead && <p>binary / large asset — content withheld; act on the metadata above.</p>}
    </aside>
  );
}
```

- [ ] **Step 3: `packages/web/src/components/ChangelistList.tsx`.**
```tsx
import { useState } from "react";
import type { ChangelistSummary } from "@p4pilot/core/browser";

export function ChangelistList({ changelists, onCreate }: {
  changelists: ChangelistSummary[];
  onCreate: (description: string) => void;
}) {
  const [desc, setDesc] = useState("");
  return (
    <section>
      <h3>Pending changelists</h3>
      <ul>
        {changelists.map((cl) => (
          <li key={cl.change}>{cl.change} — {cl.description}</li>
        ))}
      </ul>
      <input aria-label="new changelist" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <button onClick={() => { if (desc.trim()) { onCreate(desc.trim()); setDesc(""); } }}>Create CL</button>
    </section>
  );
}
```

- [ ] **Step 4: `packages/web/src/components/Dashboard.tsx`.**
```tsx
import { useState } from "react";
import { useDemo } from "../demo/useDemo.js";
import { AssetInfoCard, type AssetInfo } from "./AssetInfoCard.js";
import { ChangelistList } from "./ChangelistList.js";
import { FileRow } from "./FileRow.js";

export function Dashboard() {
  const { files, changelists, ready, smartEdit, createChangelist, store } = useDemo();
  const [asset, setAsset] = useState<AssetInfo | null>(null);

  if (!ready) return <p>Loading fake depot…</p>;

  return (
    <div>
      <table>
        <thead><tr><th>kind</th><th>depot file</th><th>opened</th><th>actions</th></tr></thead>
        <tbody>
          {files.map((file) => (
            <FileRow
              key={file.depotFile}
              file={file}
              onCheckout={(cf) => void smartEdit(cf)}
              onInspect={(cf) => void store.assetInfo(cf).then(setAsset)}
            />
          ))}
        </tbody>
      </table>
      <ChangelistList changelists={changelists} onCreate={(d) => void createChangelist(d)} />
      {asset && <AssetInfoCard info={asset} onClose={() => setAsset(null)} />}
    </div>
  );
}
```

- [ ] **Step 5: Write `packages/web/src/components/Dashboard.test.tsx`.**
```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoProvider } from "../demo/useDemo.js";
import { Dashboard } from "./Dashboard.js";

function renderDashboard() {
  return render(<DemoProvider><Dashboard /></DemoProvider>);
}

describe("Dashboard", () => {
  it("shows the large-asset badge and a withheld-content card", async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getAllByText("large-asset").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Asset info")[0]!);
    await waitFor(() => expect(screen.getByTestId("asset-info")).toBeDefined());
    expect(screen.getByText(/content withheld/)).toBeDefined();
  });

  it("creates a changelist", async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByLabelText("new changelist")).toBeDefined());
    fireEvent.change(screen.getByLabelText("new changelist"), { target: { value: "dash tuning" } });
    fireEvent.click(screen.getByText("Create CL"));
    await waitFor(() => expect(screen.getByText(/\[p4pilot\] dash tuning/)).toBeDefined());
  });
});
```

- [ ] **Step 6: Run.** `npm test -w @p4pilot/web -- Dashboard` → PASS.

- [ ] **Step 7: Commit.**
```bash
git add packages/web/src/components
git commit -m "feat(web): dashboard view (files, asset guard, changelists)"
```

---

## Task 8: Review view + diff view

**Files:**
- Create: `packages/web/src/components/DiffView.tsx`, `packages/web/src/components/ReviewView.tsx`
- Test: `packages/web/src/components/ReviewView.test.tsx`

**Interfaces:**
- Consumes: `useDemo` (`store.review`, `changelists`), `DiffRow`, `ReviewData`.
- Produces: `ReviewView`, `DiffView` components.

- [ ] **Step 1: `packages/web/src/components/DiffView.tsx`.**
```tsx
import type { DiffRow } from "../diff.js";

export function DiffView({ rows }: { rows: DiffRow[] }) {
  if (rows.length === 0) return <p>(no diff available)</p>;
  const prefix = { add: "+", del: "-", ctx: " " } as const;
  return (
    <pre className="diff" data-testid="diff">
      {rows.map((row, i) => (
        <div key={i} className={row.type}>{prefix[row.type]} {row.text}</div>
      ))}
    </pre>
  );
}
```

- [ ] **Step 2: `packages/web/src/components/ReviewView.tsx`.**
```tsx
import { useEffect, useState } from "react";
import { useDemo } from "../demo/useDemo.js";
import type { ReviewData } from "../demo/store.js";
import { DiffView } from "./DiffView.js";

export function ReviewView() {
  const { changelists, store } = useDemo();
  const [change, setChange] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewData | null>(null);

  useEffect(() => {
    if (change === null) return;
    void store.review(change).then(setReview);
  }, [change, store]);

  return (
    <div>
      <h3>Changelist review</h3>
      <select aria-label="pick changelist" value={change ?? ""} onChange={(e) => setChange(e.target.value || null)}>
        <option value="">— pick a changelist —</option>
        {changelists.map((cl) => (
          <option key={cl.change} value={cl.change}>{cl.change} — {cl.description}</option>
        ))}
      </select>
      {review && (
        <div>
          <p>Change {review.change} by {review.user ?? "unknown"} — {review.description}</p>
          {review.files.map((file) => (
            <div key={file.depotFile}>
              <h4>{file.action} {file.depotFile}</h4>
              <DiffView rows={file.rows} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `packages/web/src/components/ReviewView.test.tsx`.**
```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoProvider } from "../demo/useDemo.js";
import { ReviewView } from "./ReviewView.js";

describe("ReviewView", () => {
  it("renders a real diff for the pending changelist", async () => {
    render(<DemoProvider><ReviewView /></DemoProvider>);
    await waitFor(() => expect(screen.getByLabelText("pick changelist")).toBeDefined());
    fireEvent.change(screen.getByLabelText("pick changelist"), { target: { value: "812" } });
    await waitFor(() => expect(screen.getByTestId("diff")).toBeDefined());
    expect(screen.getByText(/StartDash/)).toBeDefined();
  });
});
```

- [ ] **Step 4: Run.** `npm test -w @p4pilot/web -- ReviewView` → PASS.

- [ ] **Step 5: Commit.**
```bash
git add packages/web/src/components/DiffView.tsx packages/web/src/components/ReviewView.tsx packages/web/src/components/ReviewView.test.tsx
git commit -m "feat(web): changelist review view with unified diff"
```

---

## Task 9: App integration (header + tabs)

**Files:**
- Modify: `packages/web/src/App.tsx`
- Create: `packages/web/src/components/Header.tsx`
- Test: `packages/web/src/App.integration.test.tsx`

**Interfaces:**
- Consumes: `DemoProvider`, `Dashboard`, `ReviewView`, `Header`.

- [ ] **Step 1: `packages/web/src/components/Header.tsx`.**
```tsx
export function Header() {
  return (
    <header>
      <h1>🧭 p4pilot</h1>
      <p>Running the real <code>@p4pilot/core</code> engine in your browser — mock depot, no server.</p>
      <a href="https://github.com/sdvgdfvds/p4pilot">GitHub</a>
    </header>
  );
}
```

- [ ] **Step 2: Rewrite `packages/web/src/App.tsx`.**
```tsx
import { useState } from "react";
import { Header } from "./components/Header.js";
import { Dashboard } from "./components/Dashboard.js";
import { ReviewView } from "./components/ReviewView.js";
import { DemoProvider } from "./demo/useDemo.js";

export function App() {
  const [tab, setTab] = useState<"dashboard" | "review">("dashboard");
  return (
    <DemoProvider>
      <main data-testid="app">
        <Header />
        <nav>
          <button onClick={() => setTab("dashboard")} disabled={tab === "dashboard"}>Dashboard</button>
          <button onClick={() => setTab("review")} disabled={tab === "review"}>Review</button>
        </nav>
        {tab === "dashboard" ? <Dashboard /> : <ReviewView />}
      </main>
    </DemoProvider>
  );
}
```

- [ ] **Step 3: Write `packages/web/src/App.integration.test.tsx`.**
```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("App integration", () => {
  it("switches between dashboard and review", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getAllByText("large-asset").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText("Review"));
    await waitFor(() => expect(screen.getByLabelText("pick changelist")).toBeDefined());
  });
});
```

- [ ] **Step 4: Run full web suite + typecheck + build.**
Run: `npm test -w @p4pilot/web` → all PASS.
Run: `npm run typecheck` (root) → clean.
Run: `npm run build -w @p4pilot/web` → `packages/web/dist` produced.

- [ ] **Step 5: Commit.**
```bash
git add packages/web/src/App.tsx packages/web/src/components/Header.tsx packages/web/src/App.integration.test.tsx
git commit -m "feat(web): wire header + dashboard/review tabs"
```

---

## Task 10: GitHub Pages deploy + README link

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

- [ ] **Step 1: Create `.github/workflows/pages.yml`.**
```yaml
name: Deploy demo to Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build -w @p4pilot/core
      - run: npm run build -w @p4pilot/web
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: packages/web/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Add the Live Demo link to `README.md`.** Under the badges block (after the `[![Node ...]]` line), add:
```markdown
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://sdvgdfvds.github.io/p4pilot/)
```
And under the status callout, add a line: `> **▶ Live demo (no install):** https://sdvgdfvds.github.io/p4pilot/`

- [ ] **Step 3: Commit.**
```bash
git add .github/workflows/pages.yml README.md
git commit -m "ci: deploy web demo to GitHub Pages + README link"
```

- [ ] **Step 4 (manual, one-time):** In GitHub → repo Settings → Pages → "Build and deployment" → Source = **GitHub Actions**. Then push `main`; the `Deploy demo to Pages` workflow publishes to `https://sdvgdfvds.github.io/p4pilot/`.

---

## Final verification (after all tasks)

- [ ] `npm run typecheck` (root) — clean.
- [ ] `npm test` (root) — core 34 + browser 2 + mcp-server 12 + web suite, all green.
- [ ] `npm run build` (root) — core + mcp-server build; `npm run build -w @p4pilot/web` — static site.
- [ ] Push `main`; confirm both workflows (CI + Pages) go green and the Live Demo URL loads and is interactive.

## Self-review notes

- **Spec coverage:** §3.1 package layout → Task 2; §3.2 core refactor → Task 1; §3.3 data flow → Tasks 4/6; §4 View 1 → Task 7; §4 View 2 → Tasks 5/8; §5 deploy → Task 10; §6 testing → tests in every task + env split (Task 2 vite.config, per-file jsdom); §7 stack → Task 2 deps; §8 acceptance → Final verification.
- **Build order note:** implement Task 5 (diff) before Task 4's `review` test compiles (Task 4 imports `../diff.js`). Tasks are numbered for reading, not strict execution order — Task 5 first, then 4.
- **Type consistency:** `FileView`, `ReviewData`, `DiffRow`, `AssetInfo` are defined once and imported everywhere they're used; store method names match their call sites in `useDemo`/components.
