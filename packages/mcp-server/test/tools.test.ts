import {
  DEFAULT_ASSET_GUARD_CONFIG,
  P4Client,
  type P4PilotConfig,
} from "@p4pilot/core";
import { MockP4Runner } from "@p4pilot/core/testing";
import { describe, expect, it } from "vitest";

import {
  assetInfo,
  changelistCreate,
  changelistList,
  describe as describeChange,
  filelog,
  review,
  search,
  smartEdit,
  status,
  type Searcher,
  type ToolContext,
} from "../src/tools.js";

const config: P4PilotConfig = {
  p4Path: "p4",
  mock: true,
  assetGuard: DEFAULT_ASSET_GUARD_CONFIG,
  defaultChangelistPrefix: "[p4pilot] ",
  env: {},
};

const seed = () =>
  new MockP4Runner({
    root: "/ws",
    user: "alice",
    client: "ws",
    files: [
      { depotFile: "//depot/a.c", clientFile: "/ws/a.c", headType: "text", headRev: 2 },
      {
        depotFile: "//depot/Hero.uasset",
        clientFile: "/ws/Hero.uasset",
        headType: "binary+l",
        headRev: 1,
        sizeBytes: 5_000_000,
      },
    ],
    changelists: [
      {
        change: "812",
        description: "wip: dash",
        status: "pending",
        user: "alice",
        client: "ws",
        files: ["//depot/a.c"],
      },
    ],
  });

function makeCtx(runner: MockP4Runner, searcher: Searcher = async () => []): ToolContext {
  return { client: new P4Client(runner), config, search: searcher };
}

describe("mcp tool handlers", () => {
  it("status: empty, then lists after an edit", async () => {
    const ctx = makeCtx(seed());
    expect((await status(ctx)).content[0]!.text).toContain("No files are currently open");
    await ctx.client.edit(["/ws/a.c"]);
    expect((await status(ctx)).content[0]!.text).toContain("//depot/a.c");
  });

  it("smartEdit opens a tracked file", async () => {
    const runner = seed();
    const result = await smartEdit(makeCtx(runner), { paths: ["/ws/a.c"] });
    expect(runner.state.files.find((f) => f.clientFile === "/ws/a.c")?.opened?.action).toBe("edit");
    expect(result.content[0]!.text).toContain("opened");
  });

  it("smartEdit warns on a binary asset", async () => {
    const result = await smartEdit(makeCtx(seed()), { paths: ["/ws/Hero.uasset"] });
    expect(result.content[0]!.text).toContain("large-asset");
  });

  it("changelistCreate prefixes the description and returns a number", async () => {
    const result = await changelistCreate(makeCtx(seed()), { description: "dash ability" });
    expect(result.content[0]!.text).toMatch(/\[p4pilot\] dash ability/);
    expect(result.content[0]!.text).toMatch(/changelist \d+/);
  });

  it("changelistList returns pending changelists", async () => {
    const result = await changelistList(makeCtx(seed()), { status: "pending" });
    expect(result.content[0]!.text).toContain("812");
  });

  it("describe and review show the changelist files", async () => {
    const ctx = makeCtx(seed());
    expect((await describeChange(ctx, { change: "812" })).content[0]!.text).toContain("//depot/a.c");
    expect((await review(ctx, { change: "812" })).content[0]!.text).toContain("Review of change 812");
  });

  it("assetInfo withholds bytes for a binary asset", async () => {
    const result = await assetInfo(makeCtx(seed()), { path: "/ws/Hero.uasset" });
    expect(result.content[0]!.text).toContain("shouldRead: false");
    expect(result.content[0]!.text).toContain("content withheld");
  });

  it("filelog returns revision history", async () => {
    const result = await filelog(makeCtx(seed()), { path: "/ws/a.c" });
    expect(result.content[0]!.text).toContain("#2");
  });

  it("search returns text hits and skips binary assets", async () => {
    const searcher: Searcher = async (query) => [
      { file: "/ws/src/hero.cpp", line: 3, text: `void ${query}()` },
      { file: "/ws/Content/Hero.uasset", line: 1, text: `bin ${query}` },
    ];
    const result = await search(makeCtx(seed(), searcher), { query: "dash" });
    expect(result.content[0]!.text).toContain("hero.cpp");
    expect(result.content[0]!.text).not.toContain("Hero.uasset");
  });
});
