/**
 * Offline p4pilot-bench style safety scenarios.
 *
 * Locks product invariants agents must not violate under MockP4Runner +
 * MemoryAuditSink (no real p4d). See docs/BENCH.md.
 */
import {
  checkPolicy,
  DEFAULT_ASSET_GUARD_CONFIG,
  MemoryAuditSink,
  P4Client,
  READ_ONLY_POLICY,
  RESTRICTED_AGENT_POLICY,
  StaticAssetDependencyProvider,
  type P4PilotConfig,
  type SafetyPolicy,
} from "@p4pilot/core";
import { MockP4Runner } from "@p4pilot/core/testing";
import { describe, expect, it } from "vitest";

import { withPolicyAndAudit } from "../src/safe-tool.js";
import {
  auditTail,
  changelistCreate,
  deleteFiles,
  REGISTERED_TOOL_NAMES,
  smartEdit,
  type ToolContext,
} from "../src/tools.js";

const config: P4PilotConfig = {
  p4Path: "p4",
  mock: true,
  assetGuard: DEFAULT_ASSET_GUARD_CONFIG,
  assetDependencies: {},
  defaultChangelistPrefix: "[p4pilot] ",
  env: {},
};

/** Depot with one text file and one Unreal binary asset. */
const seed = () =>
  new MockP4Runner({
    root: "/ws",
    user: "alice",
    client: "ws",
    files: [
      {
        depotFile: "//depot/src/hero.cpp",
        clientFile: "/ws/src/hero.cpp",
        headType: "text",
        headRev: 3,
      },
      {
        depotFile: "//depot/Content/Hero.uasset",
        clientFile: "/ws/Content/Hero.uasset",
        headType: "binary+l",
        headRev: 1,
        sizeBytes: 5_000_000,
      },
    ],
    changelists: [],
    shelvedChangelists: [],
  });

function makeCtx(
  runner: MockP4Runner,
  policy: SafetyPolicy = RESTRICTED_AGENT_POLICY,
  audit = new MemoryAuditSink(),
): ToolContext {
  return {
    client: new P4Client(runner),
    config,
    search: async () => [],
    assetDependencies: new StaticAssetDependencyProvider("empty", []),
    policy,
    audit,
    actor: "bench-agent",
  };
}

describe("bench-safety (offline agent invariants)", () => {
  it("submit_invariant: checkPolicy denies submit; no p4_submit among 21 tools", () => {
    // Hard product boundary: submit is never allowed by any preset.
    for (const policy of [RESTRICTED_AGENT_POLICY, READ_ONLY_POLICY] as const) {
      const result = checkPolicy(policy, "submit");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/submit/i);
    }

    // Surface contract: known safe set; shelve for handoff; never submit.
    expect(REGISTERED_TOOL_NAMES).toHaveLength(21);
    expect(REGISTERED_TOOL_NAMES).toContain("p4_audit_tail");
    expect(REGISTERED_TOOL_NAMES).toContain("p4_policy_info");
    expect(REGISTERED_TOOL_NAMES).toContain("p4_shelve");
    expect(REGISTERED_TOOL_NAMES).not.toContain("p4_submit");
    expect(
      REGISTERED_TOOL_NAMES.some((name) =>
        name.toLowerCase().includes("submit"),
      ),
    ).toBe(false);
    // Shelve allowed under restricted-agent; denied under read-only.
    expect(checkPolicy(RESTRICTED_AGENT_POLICY, "shelve").allowed).toBe(true);
    expect(checkPolicy(READ_ONLY_POLICY, "shelve").allowed).toBe(false);
  });

  it("restricted_denies_delete: deleteFiles → POLICY_DENIED + audit deny", async () => {
    const runner = seed();
    const audit = new MemoryAuditSink();
    const ctx = makeCtx(runner, RESTRICTED_AGENT_POLICY, audit);

    const result = await withPolicyAndAudit(
      ctx,
      {
        tool: "p4_delete",
        action: "delete",
        paths: ["/ws/src/hero.cpp"],
      },
      () => deleteFiles(ctx, { paths: ["/ws/src/hero.cpp"] }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("POLICY_DENIED");
    expect(result.content[0]!.text).toMatch(/delete/i);

    // File must remain unopened (handler never ran).
    expect(
      runner.state.files.find((f) => f.clientFile === "/ws/src/hero.cpp")
        ?.opened,
    ).toBeUndefined();

    const events = audit.tail();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tool: "p4_delete",
      action: "delete",
      decision: "deny",
      actor: "bench-agent",
      paths: ["/ws/src/hero.cpp"],
    });
  });

  it("restricted_denies_binary_edit: smartEdit on .uasset → deny + audit", async () => {
    const runner = seed();
    const audit = new MemoryAuditSink();
    const ctx = makeCtx(runner, RESTRICTED_AGENT_POLICY, audit);
    const path = "/ws/Content/Hero.uasset";

    const result = await withPolicyAndAudit(
      ctx,
      {
        tool: "p4_smart_edit",
        action: "edit",
        paths: [path],
      },
      () => smartEdit(ctx, { paths: [path] }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("POLICY_DENIED");
    expect(result.content[0]!.text).toMatch(/binary|large-asset|asset/i);

    expect(
      runner.state.files.find((f) => f.clientFile === path)?.opened,
    ).toBeUndefined();

    const events = audit.tail();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tool: "p4_smart_edit",
      action: "edit",
      decision: "deny",
      actor: "bench-agent",
      paths: [path],
    });
  });

  it("restricted_allows_text_smart_edit: smartEdit text path succeeds", async () => {
    const runner = seed();
    const audit = new MemoryAuditSink();
    const ctx = makeCtx(runner, RESTRICTED_AGENT_POLICY, audit);
    const path = "/ws/src/hero.cpp";

    const result = await withPolicyAndAudit(
      ctx,
      {
        tool: "p4_smart_edit",
        action: "edit",
        paths: [path],
      },
      () => smartEdit(ctx, { paths: [path] }),
    );

    expect(result.isError).not.toBe(true);
    expect(result.content[0]!.text).not.toContain("POLICY_DENIED");
    expect(result.content[0]!.text).toContain("opened");
    expect(
      runner.state.files.find((f) => f.clientFile === path)?.opened?.action,
    ).toBe("edit");

    const events = audit.tail();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tool: "p4_smart_edit",
      action: "edit",
      decision: "success",
      paths: [path],
    });
  });

  it("audit_tail_lists: after actions, p4_audit_tail returns JSON events", async () => {
    const runner = seed();
    const audit = new MemoryAuditSink();
    const ctx = makeCtx(runner, RESTRICTED_AGENT_POLICY, audit);

    // One deny + one success so the log is non-trivial.
    await withPolicyAndAudit(
      ctx,
      {
        tool: "p4_delete",
        action: "delete",
        paths: ["/ws/src/hero.cpp"],
      },
      () => deleteFiles(ctx, { paths: ["/ws/src/hero.cpp"] }),
    );
    await withPolicyAndAudit(
      ctx,
      {
        tool: "p4_smart_edit",
        action: "edit",
        paths: ["/ws/src/hero.cpp"],
      },
      () => smartEdit(ctx, { paths: ["/ws/src/hero.cpp"] }),
    );

    const tailResult = await withPolicyAndAudit(
      ctx,
      { tool: "p4_audit_tail", action: "audit_tail" },
      () => auditTail(ctx, { limit: 50 }),
    );

    expect(tailResult.isError).not.toBe(true);
    const events = JSON.parse(tailResult.content[0]!.text) as Array<{
      tool: string;
      action: string;
      decision: string;
    }>;

    // audit_tail itself is recorded *after* the handler returns, so tail
    // content reflects prior actions only (same contract as policy-audit tests).
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(
      events.some((e) => e.tool === "p4_delete" && e.decision === "deny"),
    ).toBe(true);
    expect(
      events.some(
        (e) => e.tool === "p4_smart_edit" && e.decision === "success",
      ),
    ).toBe(true);

    // Sink should now also hold the audit_tail success event.
    const sinkEvents = audit.tail();
    expect(sinkEvents.some((e) => e.tool === "p4_audit_tail")).toBe(true);
  });

  it("read_only_blocks_changelist_create: READ_ONLY_POLICY denies create", async () => {
    const runner = seed();
    const audit = new MemoryAuditSink();
    const ctx = makeCtx(runner, READ_ONLY_POLICY, audit);

    const result = await withPolicyAndAudit(
      ctx,
      {
        tool: "p4_changelist_create",
        action: "changelist_create",
      },
      () => changelistCreate(ctx, { description: "should not land" }),
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("POLICY_DENIED");
    expect(result.content[0]!.text).toMatch(/changelist_create|read-only/i);

    const events = audit.tail();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tool: "p4_changelist_create",
      action: "changelist_create",
      decision: "deny",
      actor: "bench-agent",
    });
  });
});
