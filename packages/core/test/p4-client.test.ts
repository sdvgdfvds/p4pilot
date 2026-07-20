import { describe, expect, it } from "vitest";

import { P4Client } from "../src/p4-client.js";
import type { P4Result, P4Runner } from "../src/p4-runner.js";
import { MockP4Runner } from "../src/testing/mock-runner.js";
import { P4PilotError } from "../src/types.js";

const ok = (stdout: string): P4Result => ({
  stdout,
  stderr: "",
  exitCode: 0,
});

const seed = () =>
  new MockP4Runner({
    root: "/ws",
    port: "ssl:example:1666",
    client: "ws-client",
    user: "alice",
    files: [
      {
        depotFile: "//depot/a.c",
        clientFile: "/ws/a.c",
        headType: "text",
        headRev: 3,
        sizeBytes: 10,
      },
      {
        depotFile: "//depot/art/hero.uasset",
        clientFile: "/ws/art/hero.uasset",
        headType: "binary+l",
        headRev: 2,
        sizeBytes: 1_048_576,
      },
    ],
    changelists: [
      {
        change: "10",
        description: "wip",
        status: "pending",
        user: "alice",
        client: "ws-client",
        files: ["//depot/a.c"],
      },
    ],
  });

describe("P4Client", () => {
  it("edit() opens a tracked file and returns typed OpenedFile[]", async () => {
    const client = new P4Client(seed());
    const opened = await client.edit(["/ws/a.c"]);
    expect(opened).toHaveLength(1);
    expect(opened[0]!.depotFile).toBe("//depot/a.c");
    expect(opened[0]!.action).toBe("edit");
  });

  it("edit() reports the requested changelist when real p4 omits it", async () => {
    const runner: P4Runner = {
      async run() {
        return ok(
          "... depotFile //depot/a.c\n" +
            "... clientFile C:\\ws\\a.c\n" +
            "... action edit\n" +
            "... type text\n",
        );
      },
    };
    const opened = await new P4Client(runner).edit(["C:\\ws\\a.c"], {
      changelist: "42",
    });
    expect(opened[0]!.change).toBe("42");
  });

  it("opened() lists files after an edit", async () => {
    const client = new P4Client(seed());
    await client.edit(["/ws/a.c"]);
    const opened = await client.opened();
    expect(opened.map((file) => file.depotFile)).toContain("//depot/a.c");
  });

  it("fstat() reports isTracked and flips isOpened after edit", async () => {
    const client = new P4Client(seed());
    const before = (await client.fstat(["/ws/a.c"]))[0]!;
    expect(before.isTracked).toBe(true);
    expect(before.isOpened).toBe(false);
    expect(before.headType).toBe("text");
    await client.edit(["/ws/a.c"]);
    const after = (await client.fstat(["/ws/a.c"]))[0]!;
    expect(after.isOpened).toBe(true);
    expect(after.action).toBe("edit");
  });

  it("newChangelist() returns a changelist number", async () => {
    const client = new P4Client(seed());
    const change = await client.newChangelist("my p4pilot change");
    expect(change).toMatch(/^\d+$/);
  });

  it("changes() returns pending changelists", async () => {
    const client = new P4Client(seed());
    const changes = await client.changes({ status: "pending" });
    expect(changes.some((changelist) => changelist.change === "10")).toBe(true);
  });

  it("describe() returns the files touched by a changelist", async () => {
    const client = new P4Client(seed());
    const described = await client.describe("10");
    expect(described.change).toBe("10");
    expect(described.files.map((file) => file.depotFile)).toContain(
      "//depot/a.c",
    );
  });

  it("describe() parses real pending output and returns its workspace diff", async () => {
    const runner: P4Runner = {
      async run(args) {
        if (args[0] === "describe") {
          return ok(
            "... change 42\n" +
              "... user alice\n" +
              "... desc tune sprint\n\n" +
              "... status pending\n" +
              "... depotFile0 //depot/a.c\n" +
              "... action0 edit\n" +
              "... rev0 3\n" +
              "... depotFile1 //depot/b.c\n" +
              "... action1 edit\n" +
              "... rev1 5\n",
          );
        }
        if (args[0] === "diff") {
          return ok(
            "... depotFile //depot/a.c\n" +
              "... clientFile C:\\ws\\a.c\n" +
              "... type text+D\n\n" +
              "@@ -1 +1 @@\n" +
              "-old\n" +
              "+new\n",
          );
        }
        return { stdout: "", stderr: "unexpected command", exitCode: 1 };
      },
    };
    const described = await new P4Client(runner).describe("42", {
      diff: true,
    });
    expect(described.files.map((file) => file.depotFile)).toEqual([
      "//depot/a.c",
      "//depot/b.c",
    ]);
    expect(described.diff).toContain("@@ -1 +1 @@");
    expect(described.diff).toContain("+new");
  });

  it("filelog() returns revision history", async () => {
    const client = new P4Client(seed());
    const log = await client.filelog("/ws/a.c");
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[0]!.rev).toBe(3);
  });

  it("sync() reports how many files were synced", async () => {
    const client = new P4Client(seed());
    const { synced } = await client.sync();
    expect(synced).toBe(2);
  });

  it("throws P4PilotError(P4_COMMAND_FAILED) on a non-zero exit", async () => {
    const client = new P4Client(seed());
    await expect(client.edit(["/ws/missing.c"])).rejects.toBeInstanceOf(
      P4PilotError,
    );
    await expect(client.edit(["/ws/missing.c"])).rejects.toMatchObject({
      code: "P4_COMMAND_FAILED",
    });
  });
});
