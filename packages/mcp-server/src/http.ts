import { startHost } from "./host-cli.js";

async function main(): Promise<void> {
  const { server, url } = await startHost(
    process.argv.slice(2),
    process.env,
    process.cwd(),
  );
  console.error(`[p4pilot-host] ${url}`);

  const shutdown = (): void => {
    server.close(() => {
      process.exitCode = 0;
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(
    `[p4pilot-host] fatal: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
