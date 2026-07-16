import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/testing/mock-runner.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
});
