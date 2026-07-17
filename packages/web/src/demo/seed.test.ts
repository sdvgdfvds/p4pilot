import { describe, expect, it } from "vitest";
import { makeSeed } from "./seed.js";

describe("makeSeed", () => {
  it("has the four demo files and one pending changelist", () => {
    const s = makeSeed();
    expect(s.depot.files).toHaveLength(4);
    expect(s.depot.changelists?.[0]!.change).toBe("812");
  });
  it("returns a fresh copy each call (no shared mutation)", () => {
    expect(makeSeed().depot).not.toBe(makeSeed().depot);
  });
  it("carries before/after content for the changed file", () => {
    expect(makeSeed().contents["//depot/game/src/player.cpp"]!.after).toContain("StartDash");
  });
});
