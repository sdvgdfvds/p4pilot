import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  DEFAULT_ASSET_GUARD_CONFIG,
  P4Client,
  type P4PilotConfig,
} from "@p4pilot/core";
import { MockP4Runner } from "@p4pilot/core/testing";
import { describe, expect, it } from "vitest";

import { createServer } from "../src/server.js";

const config: P4PilotConfig = {
  p4Path: "p4",
  mock: true,
  assetGuard: DEFAULT_ASSET_GUARD_CONFIG,
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
        headRev: 1,
      },
    ],
    changelists: [],
  });

async function connectClient(runner: MockP4Runner): Promise<Client> {
  const server = createServer({
    client: new P4Client(runner),
    config,
    search: async () => [],
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return client;
}

describe("mcp-server integration (InMemoryTransport)", () => {
  it("exposes the full p4pilot tool set via listTools", async () => {
    const client = await connectClient(seed());
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "p4_status",
        "p4_smart_edit",
        "p4_edit",
        "p4_add",
        "p4_revert",
        "p4_changelist_create",
        "p4_changelist_list",
        "p4_describe",
        "p4_review",
        "p4_asset_info",
        "p4_filelog",
        "p4_search",
      ]),
    );
  });

  it("p4_smart_edit opens a file end-to-end", async () => {
    const runner = seed();
    const client = await connectClient(runner);
    await client.callTool({
      name: "p4_smart_edit",
      arguments: { paths: ["/ws/a.c"] },
    });
    expect(
      runner.state.files.find((file) => file.clientFile === "/ws/a.c")?.opened
        ?.action,
    ).toBe("edit");
  });

  it("routes edit, revert, and add through MCP schemas", async () => {
    const runner = seed();
    const client = await connectClient(runner);

    await client.callTool({
      name: "p4_edit",
      arguments: { paths: ["/ws/a.c"], changelist: "900" },
    });
    expect(runner.state.files[0]!.opened).toEqual({
      action: "edit",
      change: "900",
    });

    await client.callTool({
      name: "p4_revert",
      arguments: { paths: ["/ws/a.c"] },
    });
    expect(runner.state.files[0]!.opened).toBeUndefined();

    await client.callTool({
      name: "p4_add",
      arguments: { paths: ["/ws/new.c"], changelist: "901" },
    });
    expect(
      runner.state.files.find((file) => file.clientFile === "/ws/new.c")
        ?.opened,
    ).toEqual({
      action: "add",
      change: "901",
    });
  });

  it("rejects an empty paths array at the MCP schema boundary", async () => {
    const client = await connectClient(seed());
    const result = await client.callTool({
      name: "p4_edit",
      arguments: { paths: [] },
    });
    expect(result.isError).toBe(true);
  });

  it("maps a P4PilotError to a tool error carrying its code", async () => {
    const client = await connectClient(seed());
    const result = await client.callTool({
      name: "p4_describe",
      arguments: { change: "999999" },
    });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toContain("P4_COMMAND_FAILED");
  });
});
