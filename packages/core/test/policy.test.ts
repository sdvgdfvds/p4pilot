import { describe, expect, it } from "vitest";

import {
  DEFAULT_SAFETY_POLICY,
  READ_ONLY_POLICY,
  RESTRICTED_AGENT_POLICY,
  assertPolicyAllowed,
  checkPolicy,
} from "../src/policy.js";
import { P4PilotError } from "../src/types.js";

describe("DEFAULT_SAFETY_POLICY", () => {
  it("denies submit by default (human submit boundary)", () => {
    const result = checkPolicy(DEFAULT_SAFETY_POLICY, "submit");
    expect(result.allowed).toBe(false);
    expect(result.action).toBe("submit");
    expect(result.reason?.toLowerCase()).toMatch(/submit/);
  });

  it("allows edit/add/delete/sync for backward compatibility", () => {
    for (const action of [
      "edit",
      "add",
      "delete",
      "sync",
      "read",
      "changelist_create",
      "audit_tail",
    ] as const) {
      const result = checkPolicy(DEFAULT_SAFETY_POLICY, action, {
        paths: ["//depot/src/foo.cpp"],
      });
      expect(result.allowed).toBe(true);
      expect(result.action).toBe(action);
    }
  });
});

describe("RESTRICTED_AGENT_POLICY", () => {
  it("denies delete and sync", () => {
    expect(checkPolicy(RESTRICTED_AGENT_POLICY, "delete").allowed).toBe(false);
    expect(checkPolicy(RESTRICTED_AGENT_POLICY, "sync").allowed).toBe(false);
    expect(checkPolicy(RESTRICTED_AGENT_POLICY, "submit").allowed).toBe(false);
  });

  it("denies edit of binary / large-asset paths", () => {
    const result = checkPolicy(RESTRICTED_AGENT_POLICY, "edit", {
      paths: ["//depot/Content/Hero.uasset"],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason?.toLowerCase()).toMatch(/binary|large-asset|asset/);
  });

  it("allows edit of text paths", () => {
    const result = checkPolicy(RESTRICTED_AGENT_POLICY, "edit", {
      paths: ["//depot/src/hero.cpp"],
    });
    expect(result.allowed).toBe(true);
  });

  it("allows read and changelist_create", () => {
    expect(checkPolicy(RESTRICTED_AGENT_POLICY, "read").allowed).toBe(true);
    expect(
      checkPolicy(RESTRICTED_AGENT_POLICY, "changelist_create").allowed,
    ).toBe(true);
  });
});

describe("READ_ONLY_POLICY", () => {
  it("denies write ops", () => {
    for (const action of [
      "edit",
      "add",
      "delete",
      "revert",
      "sync",
      "reopen",
      "changelist_create",
    ] as const) {
      expect(checkPolicy(READ_ONLY_POLICY, action).allowed).toBe(false);
    }
  });

  it("allows read, changelist_list, and audit_tail", () => {
    for (const action of ["read", "changelist_list", "audit_tail"] as const) {
      expect(checkPolicy(READ_ONLY_POLICY, action).allowed).toBe(true);
    }
  });
});

describe("assertPolicyAllowed", () => {
  it("throws P4PilotError POLICY_DENIED when denied", () => {
    expect(() => assertPolicyAllowed(DEFAULT_SAFETY_POLICY, "submit")).toThrow(
      P4PilotError,
    );

    try {
      assertPolicyAllowed(DEFAULT_SAFETY_POLICY, "submit");
    } catch (err) {
      expect(err).toBeInstanceOf(P4PilotError);
      expect((err as P4PilotError).code).toBe("POLICY_DENIED");
    }
  });

  it("does not throw when allowed", () => {
    expect(() =>
      assertPolicyAllowed(DEFAULT_SAFETY_POLICY, "edit", {
        paths: ["//depot/a.cpp"],
      }),
    ).not.toThrow();
  });
});
