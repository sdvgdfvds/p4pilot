import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_SAFETY_POLICY,
  JsonlFileAuditSink,
  MemoryAuditSink,
  READ_ONLY_POLICY,
  RESTRICTED_AGENT_POLICY,
  createAuditEvent,
} from "@p4pilot/core";
import { describe, expect, it } from "vitest";

import { buildCore, resolveSafetyPolicy } from "../src/core-factory.js";

describe("buildCore mock mode", () => {
  it("loads the bundled demo depot", async () => {
    const built = buildCore(["--mock"], {});
    expect(built.mock).toBe(true);
    expect(built.policy).toBe(DEFAULT_SAFETY_POLICY);
    expect(built.audit.tail()).toEqual([]);
    await expect(built.client.info()).resolves.toMatchObject({
      clientName: "p4pilot-demo",
      userName: "demo",
    });
    const [asset] = await built.client.fstat([
      "/depot/game/Content/Hero.uasset",
    ]);
    expect(asset).toMatchObject({
      headRev: 3,
      headType: "binary+l",
      isTracked: true,
    });
  });

  it("creates independent state for every mock server", async () => {
    const first = buildCore(["--mock"], {});
    await first.client.edit(["/depot/game/src/main.cpp"]);
    expect(await first.client.opened()).toHaveLength(1);

    const second = buildCore(["--mock"], {});
    expect(await second.client.opened()).toHaveLength(0);
  });

  it("honours P4PILOT_POLICY", () => {
    expect(resolveSafetyPolicy({})).toBe(DEFAULT_SAFETY_POLICY);
    expect(resolveSafetyPolicy({ P4PILOT_POLICY: "restricted-agent" })).toBe(
      RESTRICTED_AGENT_POLICY,
    );
    expect(resolveSafetyPolicy({ P4PILOT_POLICY: "read-only" })).toBe(
      READ_ONLY_POLICY,
    );
    expect(() => resolveSafetyPolicy({ P4PILOT_POLICY: "nope" })).toThrow(
      /unknown P4PILOT_POLICY/,
    );

    const restricted = buildCore(["--mock"], {
      P4PILOT_POLICY: "restricted-agent",
    });
    expect(restricted.policy).toBe(RESTRICTED_AGENT_POLICY);
  });

  it("applies P4PILOT_PATH_ALLOWLIST onto the resolved preset", () => {
    const withList = resolveSafetyPolicy({
      P4PILOT_POLICY: "restricted-agent",
      P4PILOT_PATH_ALLOWLIST: "//depot/sandbox,//depot/tools",
    });
    expect(withList.name).toBe("restricted-agent");
    expect(withList.pathAllowlist).toEqual([
      "//depot/sandbox",
      "//depot/tools",
    ]);
    // Not the frozen preset reference once allowlist is layered on.
    expect(withList).not.toBe(RESTRICTED_AGENT_POLICY);

    const empty = resolveSafetyPolicy({
      P4PILOT_PATH_ALLOWLIST: "  ,  ",
    });
    expect(empty).toBe(DEFAULT_SAFETY_POLICY);
    expect(empty.pathAllowlist).toBeUndefined();

    const semi = resolveSafetyPolicy({
      P4PILOT_PATH_ALLOWLIST: "//depot/a;//depot/b",
    });
    expect(semi.pathAllowlist).toEqual(["//depot/a", "//depot/b"]);

    const built = buildCore(["--mock"], {
      P4PILOT_POLICY: "default",
      P4PILOT_PATH_ALLOWLIST: "//depot/sandbox",
    });
    expect(built.policy.pathAllowlist).toEqual(["//depot/sandbox"]);
  });

  it("uses JsonlFileAuditSink when P4PILOT_AUDIT_LOG is set", () => {
    const dir = mkdtempSync(join(tmpdir(), "p4pilot-audit-"));
    const filePath = join(dir, "audit.jsonl");
    const built = buildCore(["--mock"], { P4PILOT_AUDIT_LOG: filePath });
    expect(built.audit).toBeInstanceOf(JsonlFileAuditSink);
    built.audit.record(
      createAuditEvent({
        tool: "p4_status",
        action: "read",
        decision: "success",
      }),
    );
    const lines = readFileSync(filePath, "utf8")
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).tool).toBe("p4_status");

    const memory = buildCore(["--mock"], {});
    expect(memory.audit).toBeInstanceOf(MemoryAuditSink);
  });
});