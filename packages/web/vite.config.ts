import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/p4pilot/",
  plugins: [react()],
  test: {
    globals: true,
    environment: "node", // per-file `// @vitest-environment jsdom` for component tests
  },
});
