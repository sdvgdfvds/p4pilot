import { describe, expect, it } from "vitest";
import { DemoStore } from "./store.js";

describe("DemoStore", () => {
  it("lists four files with asset kinds", async () => {
    const files = await new DemoStore().listFiles();
    expect(files).toHaveLength(4);
    expect(files.find((f) => f.clientFile.endsWith("Hero.uasset"))!.kind).toBe(
      "large-asset",
    );
  });

  it("smart-edit opens a file", async () => {
    const store = new DemoStore();
    const result = await store.smartEdit("/depot/game/src/main.cpp");
    expect(result.status).toBe("opened");
    const files = await store.listFiles();
    expect(files.find((f) => f.clientFile.endsWith("main.cpp"))!.opened).toBe(
      true,
    );
  });

  it("smart-edit flags a large asset", async () => {
    const result = await new DemoStore().smartEdit(
      "/depot/game/Content/Hero.uasset",
    );
    expect(result.asset?.shouldRead).toBe(false);
  });

  it("creates a prefixed changelist", async () => {
    const store = new DemoStore();
    const change = await store.createChangelist("dash tuning");
    const cls = await store.listChangelists();
    expect(cls.find((c) => c.change === change)!.description).toContain(
      "[p4pilot] dash tuning",
    );
  });

  it("review returns a non-empty diff for the seeded file", async () => {
    const review = await new DemoStore().review("812");
    const file = review.files.find((f) => f.depotFile.endsWith("player.cpp"))!;
    expect(file.rows.some((r) => r.type === "add")).toBe(true);
  });

  it("seeds realistic allow/deny audit events for the demo panel", async () => {
    const events = await new DemoStore().listAuditEvents();
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      tool: "p4_smart_edit",
      action: "edit",
      decision: "success",
    });
    expect(events[1]).toMatchObject({
      action: "delete",
      decision: "deny",
    });
    expect(events[2]).toMatchObject({
      action: "submit",
      decision: "deny",
    });
    const limited = await new DemoStore().listAuditEvents(1);
    expect(limited).toHaveLength(1);
    expect(limited[0]!.action).toBe("submit");
  });
});
