import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildChangelistDescription } from "../src/changelist.js";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const dirs: string[] = [];
  const mkdir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "p4pilot-"));
    dirs.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns defaults with no file or env", () => {
    const config = loadConfig({ cwd: mkdir(), env: {} });
    expect(config.p4Path).toBe("p4");
    expect(config.mock).toBe(false);
    expect(config.defaultChangelistPrefix).toBe("[p4pilot] ");
  });

  it("sets mock=true when P4PILOT_MOCK=1", () => {
    expect(loadConfig({ cwd: mkdir(), env: { P4PILOT_MOCK: "1" } }).mock).toBe(
      true,
    );
  });

  it("flows P4PORT/P4CLIENT/P4USER into config.env", () => {
    const config = loadConfig({
      cwd: mkdir(),
      env: { P4PORT: "ssl:example:1666", P4CLIENT: "ws", P4USER: "alice" },
    });
    expect(config.env).toEqual({
      P4PORT: "ssl:example:1666",
      P4CLIENT: "ws",
      P4USER: "alice",
    });
  });

  it("reads .p4pilot.json from cwd to override the changelist prefix", () => {
    const dir = mkdir();
    writeFileSync(
      join(dir, ".p4pilot.json"),
      JSON.stringify({ defaultChangelistPrefix: "[hoyo] " }),
    );
    expect(loadConfig({ cwd: dir, env: {} }).defaultChangelistPrefix).toBe(
      "[hoyo] ",
    );
  });
});

describe("buildChangelistDescription", () => {
  it("prefixes the intent", () => {
    expect(buildChangelistDescription("fix crash")).toBe("[p4pilot] fix crash");
  });

  it("does not double-prefix", () => {
    expect(buildChangelistDescription("[p4pilot] fix crash")).toBe(
      "[p4pilot] fix crash",
    );
  });
});
