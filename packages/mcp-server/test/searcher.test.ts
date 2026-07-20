import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { P4Client } from "@p4pilot/core";
import { afterEach, describe, expect, it } from "vitest";

import { createNodeSearcher } from "../src/searcher.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("createNodeSearcher", () => {
  it("honors the requested glob", async () => {
    const root = mkdtempSync(join(tmpdir(), "p4pilot-search-"));
    roots.push(root);
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "player.cpp"), "void needle();\n");
    writeFileSync(join(root, "notes.txt"), "needle\n");

    const client = {
      info: async () => ({ clientRoot: root }),
    } as P4Client;
    const search = createNodeSearcher(client);

    const hits = await search("needle", { glob: "**/*.cpp" });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.file).toBe(join(root, "src", "player.cpp"));
  });
});
