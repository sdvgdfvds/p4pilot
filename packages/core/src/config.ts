import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { AssetGuardConfig } from "./asset-guard.js";
import { DEFAULT_ASSET_GUARD_CONFIG } from "./asset-guard.js";

export interface P4PilotConfig {
  p4Path: string;
  mock: boolean;
  assetGuard: AssetGuardConfig;
  defaultChangelistPrefix: string;
  env: { P4PORT?: string; P4CLIENT?: string; P4USER?: string };
}

interface FileConfig {
  p4Path?: string;
  defaultChangelistPrefix?: string;
  assetGuard?: Partial<AssetGuardConfig>;
}

function findConfigFile(cwd: string): string | undefined {
  let dir = cwd;
  for (;;) {
    const candidate = join(dir, ".p4pilot.json");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function readFileConfig(cwd: string): FileConfig {
  const file = findConfigFile(cwd);
  if (file === undefined) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as FileConfig;
  } catch {
    return {};
  }
}

/**
 * Merge configuration: defaults < `.p4pilot.json` (searched from `cwd` upward)
 * < environment variables.
 */
export function loadConfig(opts?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): P4PilotConfig {
  const cwd = opts?.cwd ?? process.cwd();
  const env = opts?.env ?? process.env;
  const fileConfig = readFileConfig(cwd);
  const mockFlag = env.P4PILOT_MOCK;

  return {
    p4Path: env.P4PILOT_P4PATH ?? fileConfig.p4Path ?? "p4",
    mock: mockFlag === "1" || mockFlag === "true",
    assetGuard: { ...DEFAULT_ASSET_GUARD_CONFIG, ...fileConfig.assetGuard },
    defaultChangelistPrefix: fileConfig.defaultChangelistPrefix ?? "[p4pilot] ",
    env: {
      P4PORT: env.P4PORT,
      P4CLIENT: env.P4CLIENT,
      P4USER: env.P4USER,
    },
  };
}
