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
});
