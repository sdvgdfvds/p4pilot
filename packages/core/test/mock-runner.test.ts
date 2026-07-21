import { describe, it, expect } from "vitest";
import { MockP4Runner } from "../src/testing/mock-runner.js";
import { parseZtag } from "../src/ztag.js";

const seed = () =>
  new MockP4Runner({
    root: "/ws",
    port: "ssl:x:1666",
    client: "c",
    user: "u",
    files: [
      {
        depotFile: "//depot/a.c",
        clientFile: "/ws/a.c",
        headType: "text",
        headRev: 1,
        sizeBytes: 10,
      },
    ],
  });

describe("MockP4Runner", () => {
  it("fstat emits parseable ztag with headType", async () => {
    const r = await seed().run(["fstat", "/ws/a.c"]);
    expect(r.exitCode).toBe(0);
    expect(parseZtag(r.stdout)[0]!.get("headType")).toBe("text");
  });
  it("edit opens the file in state", async () => {
    const m = seed();
    await m.run(["edit", "/ws/a.c"]);
    expect(m.state.files[0]!.opened?.action).toBe("edit");
  });
  it("add creates an opened, untracked file", async () => {
    const m = seed();
    await m.run(["add", "/ws/new.c"]);
    expect(
      m.state.files.find((f) => f.clientFile === "/ws/new.c")?.opened?.action,
    ).toBe("add");
  });
  it("delete opens a tracked file for delete", async () => {
    const m = seed();
    const result = await m.run(["delete", "-c", "42", "/ws/a.c"]);
    expect(result.exitCode).toBe(0);
    expect(m.state.files[0]!.opened).toEqual({
      action: "delete",
      change: "42",
    });
  });
  it("reopen preserves the action and changes the changelist", async () => {
    const m = seed();
    await m.run(["edit", "/ws/a.c"]);
    const result = await m.run(["reopen", "-c", "43", "/ws/a.c"]);
    expect(result.exitCode).toBe(0);
    expect(m.state.files[0]!.opened).toEqual({
      action: "edit",
      change: "43",
    });
  });
  it("sync honors requested paths", async () => {
    const result = await seed().run(["sync", "/ws/a.c"]);
    expect(parseZtag(result.stdout)).toHaveLength(1);
  });
});
