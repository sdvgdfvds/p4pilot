import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    http: "src/http.ts",
    demo: "src/demo.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  tsconfig: "tsconfig.build.json",
  banner: { js: "#!/usr/bin/env node" },
});
