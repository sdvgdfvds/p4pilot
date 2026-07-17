import { describe, expect, it } from "vitest";
import { toDiffRows } from "./diff.js";

describe("toDiffRows", () => {
  it("marks added lines", () => {
    const rows = toDiffRows("a\nb\n", "a\nb\nc\n");
    expect(rows.find((r) => r.text === "c")!.type).toBe("add");
  });
  it("marks removed lines", () => {
    const rows = toDiffRows("a\nb\n", "a\n");
    expect(rows.find((r) => r.text === "b")!.type).toBe("del");
  });
});
