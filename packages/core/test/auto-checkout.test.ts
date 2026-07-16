import { describe, expect, it } from "vitest";

import { ensureOpenForEdit, ensureOpenForEditMany } from "../src/auto-checkout.js";
import { P4Client } from "../src/p4-client.js";
import type { P4Result, P4Runner } from "../src/p4-runner.js";
import { MockP4Runner } from "../src/testing/mock-runner.js";

const seed = () =>
  new MockP4Runner({
    root: "/ws",
    user: "alice",
    client: "ws-client",
    files: [
      { depotFile: "//depot/a.c", clientFile: "/ws/a.c", headType: "text", headRev: 1 },
      {
        depotFile: "//depot/open.c",
        clientFile: "/ws/open.c",
        headType: "text",
        headRev: 1,
        opened: { action: "edit", change: "default" },
      },
      {
        depotFile: "//depot/art/hero.uasset",
        clientFile: "/ws/art/hero.uasset",
        headType: "binary+l",
        headRev: 1,
      },
    ],
  });

describe("ensureOpenForEdit", () => {
  it("opens a tracked, unopened file (killer path)", async () => {
    const runner = seed();
    const result = await ensureOpenForEdit(new P4Client(runner), "/ws/a.c");
    expect(result.status).toBe("opened");
    expect(runner.state.files.find((f) => f.clientFile === "/ws/a.c")?.opened?.action).toBe("edit");
  });

  it("reports already-open without re-editing", async () => {
    const result = await ensureOpenForEdit(new P4Client(seed()), "/ws/open.c");
    expect(result.status).toBe("already-open");
    expect(result.action).toBe("edit");
  });

  it("adds an untracked new file", async () => {
    const runner = seed();
    const result = await ensureOpenForEdit(new P4Client(runner), "/ws/new.ts");
    expect(result.status).toBe("added");
    expect(runner.state.files.find((f) => f.clientFile === "/ws/new.ts")?.opened?.action).toBe("add");
  });

  it("classifies a .uasset edit as a large asset", async () => {
    const result = await ensureOpenForEdit(new P4Client(seed()), "/ws/art/hero.uasset");
    expect(result.status).toBe("opened");
    expect(result.asset?.kind).toBe("large-asset");
  });

  it("attaches the edit to a given changelist", async () => {
    const runner = seed();
    await ensureOpenForEdit(new P4Client(runner), "/ws/a.c", { changelist: "10" });
    expect(runner.state.files.find((f) => f.clientFile === "/ws/a.c")?.opened?.change).toBe("10");
  });
});

describe("ensureOpenForEditMany", () => {
  it("preserves input order and survives a failing path", async () => {
    const flaky: P4Runner = {
      async run(args: string[]): Promise<P4Result> {
        if (args.some((arg) => arg.includes("bad.c"))) {
          return { stdout: "", stderr: "no such file", exitCode: 1 };
        }
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    };
    const results = await ensureOpenForEditMany(new P4Client(flaky), [
      "/ws/good1.c",
      "/ws/bad.c",
      "/ws/good2.c",
    ]);
    expect(results.map((r) => r.path)).toEqual(["/ws/good1.c", "/ws/bad.c", "/ws/good2.c"]);
    expect(results[1]!.status).toBe("skipped-untracked-ignored");
    expect(results[0]!.status).toBe("added");
  });
});
