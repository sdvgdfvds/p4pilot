import { defineConfig } from "vitest/config";

// Local config so `npm test -w @p4pilot/core` runs this package's own tests
// (node env) instead of ascending to the monorepo root vitest.config.ts, whose
// `test.projects` globs only resolve from the repo root. The root config still
// collects this package for the whole-repo `npm test` run.
export default defineConfig({
  test: {
    environment: "node",
  },
});
