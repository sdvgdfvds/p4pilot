import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerTools, type ToolContext } from "./tools.js";

/** Build the p4pilot MCP server with all Perforce tools registered. */
export function createServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: "p4pilot", version: "0.0.0" });
  registerTools(server, ctx);
  return server;
}
