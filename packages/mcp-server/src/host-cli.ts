import { resolve } from "node:path";
import type { Server } from "node:http";

import { buildCore } from "./core-factory.js";
import { createHostServer } from "./host-service.js";

export interface HostArgs {
  host: "127.0.0.1" | "::1" | "localhost";
  port: number;
  webRoot: string;
}

const loopbackHosts = new Set<HostArgs["host"]>([
  "127.0.0.1",
  "::1",
  "localhost",
]);

function optionValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseHostArgs(argv: string[], cwd: string): HostArgs {
  let host: HostArgs["host"] = "127.0.0.1";
  let port = 4715;
  let webRoot = resolve(cwd, "packages/web/dist");

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--mock") continue;
    if (argument === "--host") {
      const value = optionValue(argv, index, argument);
      if (!loopbackHosts.has(value as HostArgs["host"])) {
        throw new Error("p4pilot-host may only bind to a loopback host");
      }
      host = value as HostArgs["host"];
      index += 1;
    } else if (argument === "--port") {
      port = Number(optionValue(argv, index, argument));
      if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error("--port must be an integer from 1 to 65535");
      }
      index += 1;
    } else if (argument === "--web-root") {
      webRoot = resolve(cwd, optionValue(argv, index, argument));
      index += 1;
    } else {
      throw new Error(`unknown p4pilot-host argument: ${argument ?? ""}`);
    }
  }

  return { host, port, webRoot };
}

export async function startHost(
  argv: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
): Promise<{ server: Server; url: string }> {
  const args = parseHostArgs(argv, cwd);
  const { client, config, mock } = buildCore(argv, env);
  const server = createHostServer({
    client,
    config,
    webRoot: args.webRoot,
    mode: mock ? "mock" : "live",
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(args.port, args.host, () => {
      server.off("error", reject);
      resolveListen();
    });
  });
  const displayHost = args.host === "::1" ? "[::1]" : args.host;
  return {
    server,
    url: `http://${displayHost}:${args.port}/p4pilot/?backend=local`,
  };
}
