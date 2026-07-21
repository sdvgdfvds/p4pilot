import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseDemoArgs,
  parsePendingChanges,
  resetDemo,
  resolveDemoPaths,
  startDemo,
  type DemoRuntime,
} from "../src/demo-control.js";

function fakeRuntime(options?: {
  serverReady?: boolean;
  hostReady?: boolean;
  pendingOutput?: string;
}) {
  const runs: Array<{ file: string; args: string[] }> = [];
  const spawns: Array<{
    file: string;
    args: string[];
    env?: NodeJS.ProcessEnv;
  }> = [];
  let serverReady = options?.serverReady ?? false;
  let hostReady = options?.hostReady ?? false;
  const runtime: DemoRuntime = {
    exists: () => true,
    async run(file, args) {
      runs.push({ file, args });
      if (args.at(-1) === "info") {
        return { stdout: "", stderr: "", exitCode: serverReady ? 0 : 1 };
      }
      if (args.includes("changes")) {
        return {
          stdout: options?.pendingOutput ?? "",
          stderr: "",
          exitCode: 0,
        };
      }
      return { stdout: "", stderr: "", exitCode: 0 };
    },
    spawn(file, args, spawnOptions) {
      spawns.push({ file, args, env: spawnOptions.env });
      if (file.endsWith("p4d-2025.1.exe")) serverReady = true;
      if (file === process.execPath || file.endsWith("node.exe"))
        hostReady = true;
    },
    async health() {
      return hostReady;
    },
    async sleep() {},
  };
  return { runtime, runs, spawns };
}

describe("click demo control", () => {
  it("parses start arguments and resolves every required demo path", () => {
    const args = parseDemoArgs(
      [
        "start",
        "--demo-root",
        "D:/demo",
        "--repo-root",
        "D:/repo",
        "--node",
        "node.exe",
      ],
      "D:/cwd",
    );
    expect(args).toEqual({
      command: "start",
      demoRoot: resolve("D:/demo"),
      repoRoot: resolve("D:/repo"),
      nodePath: "node.exe",
    });
    expect(resolveDemoPaths(args)).toMatchObject({
      workspace: resolve("D:/demo/workspace"),
      p4: resolve("D:/demo/bin/p4.exe"),
      p4d: resolve("D:/demo/bin/p4d-2025.1.exe"),
      hostEntry: resolve("D:/repo/packages/mcp-server/dist/http.js"),
      webRoot: resolve("D:/repo/packages/web/dist"),
      p4v: resolve("D:/demo/P4V/p4v.exe"),
    });
  });

  it("starts missing services and launches P4V with the demo connection", async () => {
    const { runtime, spawns } = fakeRuntime();
    const args = parseDemoArgs(
      ["start", "--demo-root", "D:/demo", "--repo-root", "D:/repo"],
      "D:/cwd",
    );

    await expect(startDemo(args, runtime)).resolves.toBe(
      "http://127.0.0.1:4715/p4pilot/?backend=local",
    );
    expect(spawns.map(({ file }) => file)).toEqual([
      resolve("D:/demo/bin/p4d-2025.1.exe"),
      process.execPath,
      resolve("D:/demo/P4V/p4v.exe"),
    ]);
    expect(spawns[1]!.env).toMatchObject({
      P4PORT: "localhost:1666",
      P4USER: "p4pilot_admin",
      P4CLIENT: "p4pilot_interview",
      P4PILOT_P4PATH: resolve("D:/demo/bin/p4.exe"),
    });
    expect(spawns[2]!.args).toEqual([
      "-p",
      "localhost:1666",
      "-u",
      "p4pilot_admin",
      "-c",
      "p4pilot_interview",
    ]);
  });

  it("deletes shelves and pending changes before restoring the workspace", async () => {
    const { runtime, runs } = fakeRuntime({
      serverReady: true,
      hostReady: true,
      pendingOutput:
        "... change 41\n... desc first\n\n... change 42\n... desc second\n",
    });
    const args = parseDemoArgs(
      ["reset", "--demo-root", "D:/demo", "--repo-root", "D:/repo"],
      "D:/cwd",
    );

    await resetDemo(args, runtime);

    const commands = runs.map(({ args: commandArgs }) => commandArgs.join(" "));
    expect(commands).toContain(
      "-p localhost:1666 -u p4pilot_admin -c p4pilot_interview revert //p4pilot_interview/...",
    );
    expect(commands).toContain(
      "-p localhost:1666 -u p4pilot_admin -c p4pilot_interview shelve -d -c 41",
    );
    expect(commands).toContain(
      "-p localhost:1666 -u p4pilot_admin -c p4pilot_interview change -d 42",
    );
    expect(commands.at(-1)).toBe(
      "-p localhost:1666 -u p4pilot_admin -c p4pilot_interview sync -f //p4pilot_interview/...",
    );
  });

  it("parses pending changelist numbers from real ztag records", () => {
    expect(
      parsePendingChanges(
        "... change 41\r\n... desc first\r\n\r\n... change 42\r\n",
      ),
    ).toEqual(["41", "42"]);
  });
});
