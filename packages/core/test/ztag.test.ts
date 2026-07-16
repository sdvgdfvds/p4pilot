import { describe, it, expect } from "vitest";
import { parseZtag, groupIndexed } from "../src/ztag.js";

describe("parseZtag", () => {
  it("parses two records separated by a blank line", () => {
    const out = "... depotFile //depot/a.c\n... action edit\n\n... depotFile //depot/b.c\n... action add\n";
    const recs = parseZtag(out);
    expect(recs).toHaveLength(2);
    expect(recs[0]!.get("depotFile")).toBe("//depot/a.c");
    expect(recs[0]!.get("action")).toBe("edit");
    expect(recs[1]!.get("action")).toBe("add");
  });

  it("treats non-'... ' lines as a continuation of the previous value", () => {
    const out = "... desc first line\nsecond line\n";
    const recs = parseZtag(out);
    expect(recs[0]!.get("desc")).toBe("first line\nsecond line");
  });

  it("ignores leading/trailing blank lines (no empty records)", () => {
    expect(parseZtag("\n\n... a 1\n\n\n")).toHaveLength(1);
  });
});

describe("groupIndexed", () => {
  it("collapses foo0, foo1 into arrays", () => {
    const rec = new Map([["depotFile0","//a"],["depotFile1","//b"],["change","7"]]);
    expect(groupIndexed(rec)).toEqual({ depotFile: ["//a","//b"], change: "7" });
  });
});
