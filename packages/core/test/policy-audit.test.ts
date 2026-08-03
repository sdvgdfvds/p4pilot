import { describe, expect, it } from "vitest";

import { createAuditEvent, MemoryAuditSink } from "../src/audit.js";
import {
  assertPolicyAllowed,
  checkPolicy,
  DEFAULT_SAFETY_POLICY,
  READ_ONLY_POLICY,
  RESTRICTED_AGENT_POLICY,
} from "../src/policy.js";
import { P4PilotError } from "../src/types.js";

describe("safety policy", () => {
  it("default policy allows edit and denies submit", () => {
    expect(checkPolicy(DEFAULT_SAFETY_POLICY, "edit").allowed).toBe(true);
    expect(checkPolicy(DEFAULT_SAFETY_POLICY, "delete").allowed).toBe(true);
    expect(checkPolicy(DEFAULT_SAFETY_POLICY, "submit").allowed).toBe(false);
  });

  it("restricted-agent policy denies delete and submit", () => {
    expect(checkPolicy(RESTRICTED_AGENT_POLICY, "edit").allowed).toBe(true);
    expect(checkPolicy(RESTRICTED_AGENT_POLICY, "delete").allowed).toBe(false);
    expect(checkPolicy(RESTRICTED_AGENT_POLICY, "submit").allowed).toBe(false);
  });

  it("read-only policy allows read and denies edit", () => {
    expect(checkPolicy(READ_ONLY_POLICY, "read").allowed).toBe(true);
    expect(checkPolicy(READ_ONLY_POLICY, "edit").allowed).toBe(false);
  });

  it("assertPolicyAllowed throws POLICY_DENIED", () => {
    expect(() =>
      assertPolicyAllowed(RESTRICTED_AGENT_POLICY, "delete"),
    ).toThrow(P4PilotError);
    try {
      assertPolicyAllowed(RESTRICTED_AGENT_POLICY, "delete");
    } catch (error) {
      expect(error).toMatchObject({ code: "POLICY_DENIED" });
    }
  });
});

describe("memory audit sink", () => {
  it("records and tails events", () => {
    const sink = new MemoryAuditSink();
    sink.record(
      createAuditEvent({
        tool: "p4_edit",
        action: "edit",
        decision: "success",
        paths: ["/ws/a.c"],
      }),
    );
    sink.record(
      createAuditEvent({
        tool: "p4_delete",
        action: "delete",
        decision: "deny",
        message: "denied",
      }),
    );
    const tail = sink.tail(1);
    expect(tail).toHaveLength(1);
    expect(tail[0]!.decision).toBe("deny");
    expect(sink.tail()).toHaveLength(2);
  });
});
