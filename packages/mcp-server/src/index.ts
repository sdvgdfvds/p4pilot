import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createAssetDependencyProvider } from "./asset-dependency-provider.js";
import { buildCore } from "./core-factory.js";
import { createNodeSearcher } from "./searcher.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const { client, config, mock, policy, audit } = buildCore(
    process.argv.slice(2),
    process.env,
  );
  const server = createServer({
    client,
    config,
    search: createNodeSearcher(client),
    assetDependencies: createAssetDependencyProvider(config, { mock }),
    policy,
    audit,
    actor: process.env.P4PILOT_ACTOR ?? process.env.P4USER,
  });
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  console.error("[p4pilot-mcp] fatal:", error);
  process.exitCode = 1;
});
