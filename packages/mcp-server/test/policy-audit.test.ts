import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  checkPolicy,
  DEFAULT_ASSET_GUARD_CONFIG,
  DEFAULT_SAFETY_POLICY,
  MemoryAuditSink,
  P4Client,
  RESTRICTED_AGENT_POLICY,
  StaticAssetDependencyProvider,
  type P4PilotConfig,
  type SafetyPolicy,
} from "@p4pilot/core";
import { MockP4Runner } from "@p4pilot/core/testing";
import { describe, expect, it } from "vitest";

import { createServer } from "../src/server.js";
import {
  REGISTERED_TOOL_NAMES,
  smartEdit,
  type ToolContext,
} from "../src/tools.js";
import { withPolicyAndAudit } from "../src/safe-tool.js";

const config: P4PilotConfig = {
  p4Path: "p4",
  mock: true,
  assetGuard: DEFAULT_ASSET_GUARD_CONFIG,
  assetDependencies: {},
  defaultChangelistPrefix: "[p4pilot] ",
  env: {},
};

const seed = () =>
  new MockP4Runner({
    root: "/ws",
    user: "alice",
    client: "ws",
    files: [
      {
        depotFile: "//depot/a.c",
        clientFile: "/ws/a.c",
        headType: "text",
        headRev: 2,
      },
    ],
    changelists: [],
    shelvedChangelists: [],
  });

function makeCtx(
  runner: MockP4Runner,
  policy: SafetyPolicy = DEFAULT_SAFETY_POLICY,
  audit = new MemoryAuditSink(),
): ToolContext {
  return {
    client: new P4Client(runner),
    config,
    search: async () => [],
    assetDependencies: new StaticAssetDependencyProvider("empty", []),
    policy,
    audit,
    actor: "test-agent",
  };
}

async function connectClient(
  runner: MockP4Runner,
  policy: SafetyPolicy = DEFAULT_SAFETY_POLICY,
  audit = new MemoryAuditSink(),
): Promise<{ client: Client; audit: MemoryAuditSink }> {
  const server = createServer(makeCtx(runner, policy, audit));
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, audit };
}

describe("mcp policy + audit wiring", () => {
  it("restricted policy denies delete and records an audit deny event", async () => {
    const audit = new MemoryAuditSink();
    const { client } = await connectClient(
      seed(),
      RESTRICTED_AGENT_POLICY,
      audit,
    );

    const result = await client.callTool({
      name: "p4_delete",
      arguments: { paths: ["/ws/a.c"] },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toContain("POLICY_DENIED");
    expect(content[0]!.text).toContain("delete");

    const events = audit.tail();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tool: "p4_delete",
      action: "delete",
      decision: "deny",
      actor: "test-agent",
      paths: ["/ws/a.c"],
    });
  });

  it("default policy allows smart_edit on a text path and audits success", async () => {
    const runner = seed();
    const audit = new MemoryAuditSink();
    const ctx = makeCtx(runner, DEFAULT_SAFETY_POLICY, audit);

    const result = await withPolicyAndAudit(
      ctx,
      {
        tool: "p4_smart_edit",
        action: "edit",
        paths: ["/ws/a.c"],
      },
      () => smartEdit(ctx, { paths: ["/ws/a.c"] }),
    );

    expect(result.isError).not.toBe(true);
    expect(result.content[0]!.text).toContain("opened");
    expect(
      runner.state.files.find((file) => file.clientFile === "/ws/a.c")?.opened
        ?.action,
    ).toBe("edit");

    const events = audit.tail();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tool: "p4_smart_edit",
      action: "edit",
      decision: "success",
      paths: ["/ws/a.c"],
    });
    expect(typeof events[0]!.durationMs).toBe("number");
  });

  it("p4_audit_tail returns recorded events as JSON", async () => {
    const audit = new MemoryAuditSink();
    const { client } = await connectClient(
      seed(),
      DEFAULT_SAFETY_POLICY,
      audit,
    );

    await client.callTool({
      name: "p4_status",
      arguments: {},
    });

    const first = await client.callTool({
      name: "p4_audit_tail",
      arguments: { limit: 10 },
    });
    expect(first.isError).not.toBe(true);
    const firstContent = first.content as Array<{ type: string; text: string }>;
    const firstEvents = JSON.parse(firstContent[0]!.text) as Array<{
      tool: string;
      decision: string;
    }>;
    expect(firstEvents.some((event) => event.tool === "p4_status")).toBe(true);

    // The audit_tail invocation is recorded after the handler returns, so a
    // subsequent tail call sees the prior audit_tail success event.
    const second = await client.callTool({
      name: "p4_audit_tail",
      arguments: { limit: 10 },
    });
    const secondContent = second.content as Array<{
      type: string;
      text: string;
    }>;
    const secondEvents = JSON.parse(secondContent[0]!.text) as Array<{
      tool: string;
    }>;
    expect(secondEvents.some((event) => event.tool === "p4_audit_tail")).toBe(
      true,
    );
  });

  it("never registers a submit tool and always denies the submit action", () => {
    expect(REGISTERED_TOOL_NAMES).not.toContain("p4_submit");
    expect(REGISTERED_TOOL_NAMES.some((name) => name.includes("submit"))).toBe(
      false,
    );

    for (const policy of [
      DEFAULT_SAFETY_POLICY,
      RESTRICTED_AGENT_POLICY,
    ] as const) {
      const result = checkPolicy(policy, "submit");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/submit/i);
    }
  });
});
