import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  MemoryAuditSink,
  TeeAuditSink,
  createAuditEvent,
  type AuditEvent,
} from "../src/audit.js";
import {
  JsonlFileAuditSink,
  createAuditSinkFromEnv,
} from "../src/jsonl-audit.js";
import { P4PilotError } from "../src/types.js";

describe("JsonlFileAuditSink", () => {
  const dirs: string[] = [];
  const mkdir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "p4pilot-audit-"));
    dirs.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("appends JSONL lines, tails in memory, and re-reads valid JSON lines", () => {
    const dir = mkdir();
    const filePath = join(dir, "nested", "audit.jsonl");
    const sink = new JsonlFileAuditSink({ filePath });

    expect(sink.filePath).toBe(filePath);

    const a = createAuditEvent({
      id: "e1",
      tool: "p4_edit",
      action: "edit",
      decision: "success",
    });
    const b = createAuditEvent({
      id: "e2",
      tool: "p4_status",
      action: "read",
      decision: "success",
    });
    sink.record(a);
    sink.record(b);

    const listed = sink.tail();
    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe("e1");
    expect(listed[1]?.id).toBe("e2");
    expect(sink.tail(1)).toEqual([b]);

    const raw = readFileSync(filePath, "utf8");
    const lines = raw.split("\n").filter((line) => line.length > 0);
    expect(lines).toHaveLength(2);
    const parsed = lines.map((line) => JSON.parse(line) as AuditEvent);
    expect(parsed[0]?.id).toBe("e1");
    expect(parsed[1]?.id).toBe("e2");
    expect(parsed[0]?.tool).toBe("p4_edit");
  });

  it("throws P4PilotError INVALID_INPUT for empty filePath", () => {
    expect(() => new JsonlFileAuditSink({ filePath: "" })).toThrow(
      P4PilotError,
    );
    try {
      new JsonlFileAuditSink({ filePath: "   " });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(P4PilotError);
      expect((err as P4PilotError).code).toBe("INVALID_INPUT");
    }
  });

  it("keeps memory buffer when write fails and does not throw", () => {
    // On Windows, a path with an invalid device name segment fails writes.
    const sink = new JsonlFileAuditSink({
      filePath: join(mkdir(), "\0invalid.jsonl"),
    });
    const event = createAuditEvent({
      id: "mem-only",
      tool: "t",
      action: "read",
      decision: "success",
    });
    expect(() => sink.record(event)).not.toThrow();
    expect(sink.tail()).toHaveLength(1);
    expect(sink.tail()[0]?.id).toBe("mem-only");
  });

  it("ring buffer respects maxEvents", () => {
    const filePath = join(mkdir(), "ring.jsonl");
    const sink = new JsonlFileAuditSink({ filePath, maxEvents: 2 });
    for (let i = 0; i < 4; i++) {
      sink.record(
        createAuditEvent({
          id: `e${i}`,
          tool: `t${i}`,
          action: "read",
          decision: "success",
        }),
      );
    }
    expect(sink.tail().map((e) => e.id)).toEqual(["e2", "e3"]);
  });
});

describe("TeeAuditSink", () => {
  it("fans out record to both sinks and tails from primary", () => {
    const primary = new MemoryAuditSink();
    const secondary = new MemoryAuditSink();
    const tee = new TeeAuditSink(primary, secondary);

    const event = createAuditEvent({
      id: "tee-1",
      tool: "p4_edit",
      action: "edit",
      decision: "success",
    });
    tee.record(event);

    expect(primary.tail()).toHaveLength(1);
    expect(secondary.tail()).toHaveLength(1);
    expect(primary.tail()[0]?.id).toBe("tee-1");
    expect(secondary.tail()[0]?.id).toBe("tee-1");
    expect(tee.tail()).toEqual(primary.tail());
    expect(tee.tail(1)).toEqual(primary.tail(1));
  });
});

describe("createAuditSinkFromEnv", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns MemoryAuditSink when P4PILOT_AUDIT_LOG is unset", () => {
    const sink = createAuditSinkFromEnv({});
    expect(sink).toBeInstanceOf(MemoryAuditSink);
    const event = createAuditEvent({
      tool: "t",
      action: "read",
      decision: "success",
    });
    sink.record(event);
    expect(sink.tail()).toHaveLength(1);
  });

  it("returns MemoryAuditSink when P4PILOT_AUDIT_LOG is empty", () => {
    expect(createAuditSinkFromEnv({ P4PILOT_AUDIT_LOG: "" })).toBeInstanceOf(
      MemoryAuditSink,
    );
    expect(createAuditSinkFromEnv({ P4PILOT_AUDIT_LOG: "  " })).toBeInstanceOf(
      MemoryAuditSink,
    );
  });

  it("returns JsonlFileAuditSink when P4PILOT_AUDIT_LOG is a path", () => {
    const dir = mkdtempSync(join(tmpdir(), "p4pilot-audit-env-"));
    dirs.push(dir);
    const filePath = join(dir, "from-env.jsonl");
    const sink = createAuditSinkFromEnv({ P4PILOT_AUDIT_LOG: filePath });
    expect(sink).toBeInstanceOf(JsonlFileAuditSink);

    const event = createAuditEvent({
      id: "env-1",
      tool: "t",
      action: "read",
      decision: "success",
    });
    sink.record(event);
    expect(sink.tail()[0]?.id).toBe("env-1");

    const lines = readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line.length > 0);
    expect(lines).toHaveLength(1);
    expect((JSON.parse(lines[0]!) as AuditEvent).id).toBe("env-1");
  });
});
