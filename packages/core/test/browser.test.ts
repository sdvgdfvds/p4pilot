import { describe, expect, it } from "vitest";
import { MockP4Runner, P4Client, classifyAsset } from "../src/browser.js";

const seed = () =>
  new MockP4Runner({
    root: "/ws",
    user: "u",
    client: "c",
    files: [{ depotFile: "//depot/a.cpp", clientFile: "/ws/a.cpp", headType: "text", headRev: 1 }],
    changelists: [],
  });

describe("@p4pilot/core/browser", () => {
  it("drives a checkout through P4Client without Node deps", async () => {
    const client = new P4Client(seed());
    const opened = await client.edit(["/ws/a.cpp"]);
    expect(opened[0]!.depotFile).toBe("//depot/a.cpp");
  });

  it("classifies assets", () => {
    expect(classifyAsset("/ws/Hero.uasset").shouldRead).toBe(false);
  });
});
