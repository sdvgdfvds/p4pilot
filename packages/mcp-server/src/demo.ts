import { execFile, spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  parseDemoArgs,
  resetDemo,
  startDemo,
  type DemoCommandResult,
  type DemoRuntime,
} from "./demo-control.js";

const runtime: DemoRuntime = {
  exists: existsSync,
  run(file, args, options) {
    return new Promise<DemoCommandResult>((resolveRun) => {
      execFile(
        file,
        args,
        {
          cwd: options?.cwd,
          env: options?.env,
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          const exitCode =
            error === null
              ? 0
              : typeof error.code === "number"
                ? error.code
                : 1;
          resolveRun({ stdout, stderr, exitCode });
        },
      );
    });
  },
  spawn(file, args, options) {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: options.env,
      detached: true,
      stdio: "ignore",
      windowsHide: options.visible !== true,
    });
    child.unref();
  },
  async health(url) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1_000),
      });
      if (!response.ok) return false;
      const body = (await response.json()) as { ok?: unknown };
      return body.ok === true;
    } catch {
      return false;
    }
  },
  sleep(milliseconds) {
    return new Promise((resolveSleep) =>
      setTimeout(resolveSleep, milliseconds),
    );
  },
};

function logFailure(demoRoot: string, error: unknown): string {
  const path = resolve(demoRoot, "logs", "p4pilot-demo-launcher.log");
  mkdirSync(dirname(path), { recursive: true });
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  appendFileSync(path, `${new Date().toISOString()} ${message}\n`, "utf8");
  return path;
}

async function main(): Promise<void> {
  const args = parseDemoArgs(process.argv.slice(2), process.cwd());
  try {
    if (args.command === "start") {
      const url = await startDemo(args, runtime);
      process.stdout.write(`${url}\n`);
    } else {
      await resetDemo(args, runtime);
      process.stdout.write("Demo reset complete. No files are open.\n");
    }
  } catch (error) {
    const log = logFailure(args.demoRoot, error);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)} (log: ${log})`,
      { cause: error },
    );
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `p4pilot-demo: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
