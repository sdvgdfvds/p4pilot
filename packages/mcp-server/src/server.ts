import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { P4Client, P4PilotConfig } from "@p4pilot/core";

/**
 * Build the p4pilot MCP server. Tools are registered here; Milestone 2.2+ adds
 * the full tool set. `p4_status` is wired first to prove the pipeline.
 */
export function createServer(client: P4Client, config: P4PilotConfig): McpServer {
  const server = new McpServer({ name: "p4pilot", version: "0.0.0" });

  server.registerTool(
    "p4_status",
    {
      title: "Perforce status",
      description: "List files currently open in the Perforce workspace, with a count summary.",
    },
    async () => {
      const opened = await client.opened();
      if (opened.length === 0) {
        return { content: [{ type: "text" as const, text: "No files are currently open." }] };
      }
      const lines = opened.map((file) => `${file.action}\t${file.depotFile} (change ${file.change})`);
      return {
        content: [
          { type: "text" as const, text: `${opened.length} open file(s):\n${lines.join("\n")}` },
        ],
      };
    },
  );

  // config is used by later tools (e.g. changelist prefixing); retained here.
  void config;
  return server;
}
