import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { buildCore } from "./core-factory.js";
import { createNodeSearcher } from "./searcher.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const { client, config } = buildCore(process.argv.slice(2), process.env);
  const server = createServer({ client, config, search: createNodeSearcher(client) });
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  console.error("[p4pilot-mcp] fatal:", error);
  process.exitCode = 1;
});
