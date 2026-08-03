import { describe, expect, it } from "vitest";

import {
  DEFAULT_SAFETY_POLICY,
  RESTRICTED_AGENT_POLICY,
  checkPolicy,
  withPathAllowlist,
  type SafetyPolicy,
} from "../src/policy.js";

const SANDBOX = "//depot/sandbox";
const ALLOWED_CPP = "//depot/sandbox/src/hero.cpp";
const OUTSIDE_CPP = "//depot/prod/src/hero.cpp";

function policyWithAllowlist(
  base: SafetyPolicy = DEFAULT_SAFETY_POLICY,
  prefixes: readonly string[] = [SANDBOX],
): SafetyPolicy {
  return withPathAllowlist(base, prefixes);
}

describe("pathAllowlist", () => {
  it("empty / undefined allowlist field adds no extra denies", () => {
    expect(
      checkPolicy(DEFAULT_SAFETY_POLICY, "edit", {
        paths: [OUTSIDE_CPP],
      }).allowed,
    ).toBe(true);

    const emptyField = withPathAllowlist(DEFAULT_SAFETY_POLICY, []);
    expect(emptyField.pathAllowlist).toBeUndefined();
    expect(
      checkPolicy(emptyField, "edit", { paths: [OUTSIDE_CPP] }).allowed,
    ).toBe(true);
  });

  it("allows a listed text path", () => {
    const policy = policyWithAllowlist();
    const result = checkPolicy(policy, "edit", { paths: [ALLOWED_CPP] });
    expect(result.allowed).toBe(true);
  });

  it("denies a path outside the allowlist", () => {
    const policy = policyWithAllowlist();
    const result = checkPolicy(policy, "edit", { paths: [OUTSIDE_CPP] });
    expect(result.allowed).toBe(false);
    expect(result.reason?.toLowerCase()).toMatch(/path|allowlist|prefix/);
    expect(result.reason).toContain(OUTSIDE_CPP);
  });

  it("denies when any of multiple paths is outside the allowlist", () => {
    const policy = policyWithAllowlist();
    const result = checkPolicy(policy, "edit", {
      paths: [ALLOWED_CPP, OUTSIDE_CPP],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain(OUTSIDE_CPP);
  });

  it("submit is still denied even on an allowed path", () => {
    const policy = policyWithAllowlist();
    const result = checkPolicy(policy, "submit", { paths: [ALLOWED_CPP] });
    expect(result.allowed).toBe(false);
    expect(result.reason?.toLowerCase()).toMatch(/submit/);
  });

  it("RESTRICTED_AGENT still denies delete even on an allowed path", () => {
    const policy = withPathAllowlist(RESTRICTED_AGENT_POLICY, [SANDBOX]);
    const result = checkPolicy(policy, "delete", { paths: [ALLOWED_CPP] });
    expect(result.allowed).toBe(false);
    expect(result.reason?.toLowerCase()).toMatch(/delete|denied|policy/);
  });

  it("denies path-based mutations when paths are empty and allowlist is set", () => {
    const policy = policyWithAllowlist();
    for (const action of [
      "edit",
      "add",
      "delete",
      "sync",
      "revert",
      "reopen",
    ] as const) {
      const result = checkPolicy(policy, action, { paths: [] });
      expect(result.allowed, action).toBe(false);
      expect(result.reason?.toLowerCase()).toMatch(/path|allowlist/);
    }
    expect(checkPolicy(policy, "edit").allowed).toBe(false);
  });

  it("does not require paths for read / changelist_create / audit_tail", () => {
    const policy = policyWithAllowlist();
    expect(checkPolicy(policy, "read").allowed).toBe(true);
    expect(checkPolicy(policy, "changelist_create").allowed).toBe(true);
    expect(checkPolicy(policy, "audit_tail").allowed).toBe(true);
  });

  it("still checks paths when read provides them", () => {
    const policy = policyWithAllowlist();
    expect(
      checkPolicy(policy, "read", { paths: [ALLOWED_CPP] }).allowed,
    ).toBe(true);
    expect(
      checkPolicy(policy, "read", { paths: [OUTSIDE_CPP] }).allowed,
    ).toBe(false);
  });

  it("normalizes backslash separators for prefix matching", () => {
    const policy = withPathAllowlist(DEFAULT_SAFETY_POLICY, [
      "C:\\work\\sandbox",
    ]);
    expect(
      checkPolicy(policy, "edit", {
        paths: ["C:/work/sandbox/src/a.cpp"],
      }).allowed,
    ).toBe(true);
    expect(
      checkPolicy(policy, "edit", {
        paths: ["C:\\work\\sandbox\\src\\b.cpp"],
      }).allowed,
    ).toBe(true);
    expect(
      checkPolicy(policy, "edit", {
        paths: ["C:/work/other/src/a.cpp"],
      }).allowed,
    ).toBe(false);
  });

  it("does not treat a longer sibling path as matching a prefix", () => {
    const policy = withPathAllowlist(DEFAULT_SAFETY_POLICY, ["//depot/src"]);
    expect(
      checkPolicy(policy, "edit", {
        paths: ["//depot/src2/foo.cpp"],
      }).allowed,
    ).toBe(false);
    expect(
      checkPolicy(policy, "edit", {
        paths: ["//depot/src/foo.cpp"],
      }).allowed,
    ).toBe(true);
    expect(
      checkPolicy(policy, "edit", {
        paths: ["//depot/src"],
      }).allowed,
    ).toBe(true);
  });
});