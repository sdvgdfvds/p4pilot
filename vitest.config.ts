import { defineConfig } from "vitest/config";

// Root test config for the monorepo. A bare `vitest run` at the root would
// otherwise load a single default config (globals: false, environment: node)
// and ignore each package's own config. In particular it would drop
// `packages/web/vite.config.ts`'s `globals: true`, so `@testing-library/react`
// would never register its global `afterEach(cleanup)` — leaking rendered DOM
// across component tests in the same file (e.g. two "new changelist" inputs).
//
// vitest 4 removed `defineWorkspace`/`vitest.workspace.ts`; the replacement is
// `test.projects`. We list each package explicitly so nothing is silently
// skipped: web reuses its own config (react plugin + globals + per-file jsdom),
// while core and mcp-server run as plain Node projects.
export default defineConfig({
  test: {
    // Global coverage floors for CI (`npm run test:coverage`). Vitest fails the
    // run when any metric drops below these values. Floors sit intentionally
    // below current overall ~85% statements so the gate is useful without flake;
    // branches are lower because UI/host edge paths are thinner than core/MCP.
    coverage: {
      exclude: ["packages/core/dist/**"],
      thresholds: {
        statements: 80,
        branches: 55,
        functions: 80,
        lines: 80,
      },
    },
    projects: [
      // Reuses packages/web/vite.config.ts (react plugin, globals, jsdom per file).
      "packages/web/vite.config.ts",
      {
        test: {
          name: "core",
          root: "packages/core",
          environment: "node",
        },
      },
      {
        test: {
          name: "mcp-server",
          root: "packages/mcp-server",
          environment: "node",
        },
      },
    ],
  },
});
