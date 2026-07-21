import { resolve } from "node:path";

export type DemoCommand = "start" | "reset";

export interface DemoArgs {
  command: DemoCommand;
  demoRoot: string;
  repoRoot: string;
  nodePath: string;
}

export interface DemoPaths extends DemoArgs {
  p4: string;
  p4d: string;
  serverRoot: string;
  serverLog: string;
  journal: string;
  workspace: string;
  hostEntry: string;
  webRoot: string;
  p4v: string;
}

export interface DemoCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DemoSpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  visible?: boolean;
}

export interface DemoRuntime {
  exists(path: string): boolean;
  run(
    file: string,
    args: string[],
    options?: { cwd?: string; env?: NodeJS.ProcessEnv },
  ): Promise<DemoCommandResult>;
  spawn(file: string, args: string[], options: DemoSpawnOptions): void;
  health(url: string): Promise<boolean>;
  sleep(milliseconds: number): Promise<void>;
}

const P4PORT = "localhost:1666";
const P4USER = "p4pilot_admin";
const P4CLIENT = "p4pilot_interview";
const HOST_URL = "http://127.0.0.1:4715/p4pilot/?backend=local";
const HEALTH_URL = "http://127.0.0.1:4715/api/health";

function optionValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

export function parseDemoArgs(argv: string[], cwd: string): DemoArgs {
  const command = argv[0];
  if (command !== "start" && command !== "reset") {
    throw new Error("p4pilot-demo requires start or reset");
  }

  let repoRoot = resolve(cwd);
  let demoRoot = resolve(repoRoot, "..", "p4pilot-real-demo");
  let nodePath = process.execPath;

  for (let index = 1; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--demo-root") {
      demoRoot = resolve(optionValue(argv, index, option));
      index += 1;
    } else if (option === "--repo-root") {
      repoRoot = resolve(optionValue(argv, index, option));
      index += 1;
    } else if (option === "--node") {
      nodePath = optionValue(argv, index, option);
      index += 1;
    } else {
      throw new Error(`unknown p4pilot-demo argument: ${option ?? ""}`);
    }
  }

  return { command, demoRoot, repoRoot, nodePath };
}

export function resolveDemoPaths(args: DemoArgs): DemoPaths {
  return {
    ...args,
    p4: resolve(args.demoRoot, "bin", "p4.exe"),
    p4d: resolve(args.demoRoot, "bin", "p4d-2025.1.exe"),
    serverRoot: resolve(args.demoRoot, "server"),
    serverLog: resolve(args.demoRoot, "logs", "p4d.log"),
    journal: resolve(args.demoRoot, "server", "journal"),
    workspace: resolve(args.demoRoot, "workspace"),
    hostEntry: resolve(
      args.repoRoot,
      "packages",
      "mcp-server",
      "dist",
      "http.js",
    ),
    webRoot: resolve(args.repoRoot, "packages", "web", "dist"),
    p4v: resolve(args.demoRoot, "P4V", "p4v.exe"),
  };
}

export function parsePendingChanges(stdout: string): string[] {
  return [...stdout.matchAll(/^\.\.\. change (\d+)$/gm)].map(
    (match) => match[1]!,
  );
}

function p4Base(): string[] {
  return ["-p", P4PORT, "-u", P4USER, "-c", P4CLIENT];
}

function requirePaths(paths: string[], runtime: DemoRuntime): void {
  const missing = paths.filter((path) => !runtime.exists(path));
  if (missing.length > 0) {
    throw new Error(`required demo file is missing: ${missing.join(", ")}`);
  }
}

async function waitUntil(
  check: () => Promise<boolean>,
  runtime: DemoRuntime,
  message: string,
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await check()) return;
    await runtime.sleep(250);
  }
  throw new Error(message);
}

async function serverReady(
  paths: DemoPaths,
  runtime: DemoRuntime,
): Promise<boolean> {
  const result = await runtime.run(paths.p4, [...p4Base(), "info"]);
  return result.exitCode === 0;
}

async function ensureServer(
  paths: DemoPaths,
  runtime: DemoRuntime,
): Promise<void> {
  requirePaths([paths.p4, paths.p4d], runtime);
  if (await serverReady(paths, runtime)) return;

  runtime.spawn(
    paths.p4d,
    [
      "-r",
      paths.serverRoot,
      "-p",
      P4PORT,
      "-L",
      paths.serverLog,
      "-J",
      paths.journal,
    ],
    { cwd: paths.demoRoot },
  );
  await waitUntil(
    () => serverReady(paths, runtime),
    runtime,
    `local Perforce server did not start; see ${paths.serverLog}`,
  );
}

function requireSuccess(result: DemoCommandResult, command: string): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `${command} failed: ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
}

export async function startDemo(
  args: DemoArgs,
  runtime: DemoRuntime,
): Promise<string> {
  const paths = resolveDemoPaths(args);
  requirePaths(
    [paths.hostEntry, resolve(paths.webRoot, "index.html"), paths.p4v],
    runtime,
  );
  await ensureServer(paths, runtime);

  if (!(await runtime.health(HEALTH_URL))) {
    runtime.spawn(
      paths.nodePath,
      [
        paths.hostEntry,
        "--host",
        "127.0.0.1",
        "--port",
        "4715",
        "--web-root",
        paths.webRoot,
      ],
      {
        cwd: paths.workspace,
        env: {
          ...process.env,
          P4PORT,
          P4USER,
          P4CLIENT,
          P4PILOT_P4PATH: paths.p4,
        },
      },
    );
    await waitUntil(
      () => runtime.health(HEALTH_URL),
      runtime,
      `p4pilot host did not become ready at ${HEALTH_URL}`,
    );
  }

  runtime.spawn(paths.p4v, p4Base(), {
    cwd: resolve(paths.demoRoot, "P4V"),
    visible: true,
  });
  return HOST_URL;
}

export async function resetDemo(
  args: DemoArgs,
  runtime: DemoRuntime,
): Promise<void> {
  const paths = resolveDemoPaths(args);
  await ensureServer(paths, runtime);

  await runtime.run(paths.p4, [...p4Base(), "revert", `//${P4CLIENT}/...`]);
  const pending = await runtime.run(paths.p4, [
    ...p4Base(),
    "-ztag",
    "changes",
    "-s",
    "pending",
    "-u",
    P4USER,
    "-c",
    P4CLIENT,
  ]);
  requireSuccess(pending, "p4 changes");

  for (const change of parsePendingChanges(pending.stdout)) {
    await runtime.run(paths.p4, [...p4Base(), "shelve", "-d", "-c", change]);
    const deleted = await runtime.run(paths.p4, [
      ...p4Base(),
      "change",
      "-d",
      change,
    ]);
    requireSuccess(deleted, `p4 change -d ${change}`);
  }

  const synced = await runtime.run(paths.p4, [
    ...p4Base(),
    "sync",
    "-f",
    `//${P4CLIENT}/...`,
  ]);
  requireSuccess(synced, "p4 sync");
}
