import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/testing/mock-runner.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  // Use a non-composite tsconfig for the build/dts step; the composite
  // tsconfig.json is reserved for the solution-style `tsc -b` typecheck.
  tsconfig: "tsconfig.build.json",
});
