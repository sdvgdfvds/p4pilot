import { describe, expect, it } from "vitest";

import {
  MemoryAuditSink,
  createAuditEvent,
  type AuditEvent,
} from "../src/audit.js";

describe("createAuditEvent", () => {
  it("fills id and timestamp when omitted", () => {
    const event = createAuditEvent({
      tool: "p4_edit",
      action: "edit",
      decision: "success",
      paths: ["//depot/a.cpp"],
    });
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.tool).toBe("p4_edit");
    expect(event.action).toBe("edit");
    expect(event.decision).toBe("success");
    expect(event.paths).toEqual(["//depot/a.cpp"]);
  });

  it("preserves provided id and timestamp", () => {
    const event = createAuditEvent({
      id: "custom-id",
      timestamp: "2020-01-01T00:00:00.000Z",
      tool: "p4_status",
      action: "read",
      decision: "success",
    });
    expect(event.id).toBe("custom-id");
    expect(event.timestamp).toBe("2020-01-01T00:00:00.000Z");
  });
});

describe("MemoryAuditSink", () => {
  it("records events and tails them newest-last", () => {
    const sink = new MemoryAuditSink();
    const a = createAuditEvent({
      tool: "t1",
      action: "read",
      decision: "success",
    });
    const b = createAuditEvent({
      tool: "t2",
      action: "edit",
      decision: "success",
    });
    sink.record(a);
    sink.record(b);
    const listed = sink.tail();
    expect(listed).toHaveLength(2);
    expect(listed[0]?.tool).toBe("t1");
    expect(listed[1]?.tool).toBe("t2");
  });

  it("limit returns the last N events", () => {
    const sink = new MemoryAuditSink();
    for (let i = 0; i < 5; i++) {
      sink.record(
        createAuditEvent({
          tool: `t${i}`,
          action: "read",
          decision: "success",
        }),
      );
    }
    const last2 = sink.tail(2);
    expect(last2).toHaveLength(2);
    expect(last2[0]?.tool).toBe("t3");
    expect(last2[1]?.tool).toBe("t4");
  });

  it("ring buffer drops oldest when maxEvents exceeded", () => {
    const sink = new MemoryAuditSink(3);
    for (let i = 0; i < 5; i++) {
      sink.record(
        createAuditEvent({
          id: `e${i}`,
          tool: `t${i}`,
          action: "read",
          decision: "success",
        }),
      );
    }
    const listed = sink.tail();
    expect(listed).toHaveLength(3);
    expect(listed.map((e: AuditEvent) => e.id)).toEqual(["e2", "e3", "e4"]);
  });

  it("default maxEvents is 1000", () => {
    const sink = new MemoryAuditSink();
    for (let i = 0; i < 1005; i++) {
      sink.record(
        createAuditEvent({
          id: `e${i}`,
          tool: "t",
          action: "read",
          decision: "success",
        }),
      );
    }
    const listed = sink.tail();
    expect(listed).toHaveLength(1000);
    expect(listed[0]?.id).toBe("e5");
    expect(listed[999]?.id).toBe("e1004");
  });
});
