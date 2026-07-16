import { ExecaP4Runner, loadConfig, P4Client, type P4PilotConfig } from "@p4pilot/core";
import { MockP4Runner, type FakeDepotState } from "@p4pilot/core/testing";

export interface BuiltCore {
  client: P4Client;
  config: P4PilotConfig;
  mock: boolean;
}

/** A believable game-repo depot used for `--mock` so the server needs no Perforce. */
const DEFAULT_MOCK_DEPOT: FakeDepotState = {
  root: "/depot/game",
  port: "ssl:perforce.example.com:1666",
  client: "p4pilot-demo",
  user: "demo",
  files: [
    {
      depotFile: "//depot/game/src/main.cpp",
      clientFile: "/depot/game/src/main.cpp",
      headType: "text",
      headRev: 4,
      sizeBytes: 2200,
    },
    {
      depotFile: "//depot/game/src/player.cpp",
      clientFile: "/depot/game/src/player.cpp",
      headType: "text",
      headRev: 7,
      sizeBytes: 5400,
    },
    {
      depotFile: "//depot/game/Content/Hero.uasset",
      clientFile: "/depot/game/Content/Hero.uasset",
      headType: "binary+l",
      headRev: 3,
      sizeBytes: 4_200_000,
    },
    {
      depotFile: "//depot/game/Art/hero_mesh.fbx",
      clientFile: "/depot/game/Art/hero_mesh.fbx",
      headType: "binary",
      headRev: 2,
      sizeBytes: 8_800_000,
    },
  ],
  changelists: [
    {
      change: "812",
      description: "wip: player dash ability",
      status: "pending",
      user: "demo",
      client: "p4pilot-demo",
      files: ["//depot/game/src/player.cpp"],
    },
  ],
};

function cleanEnv(env: P4PilotConfig["env"]): Record<string, string> {
  const out: Record<string, string> = {};
  if (env.P4PORT) out.P4PORT = env.P4PORT;
  if (env.P4CLIENT) out.P4CLIENT = env.P4CLIENT;
  if (env.P4USER) out.P4USER = env.P4USER;
  return out;
}

/**
 * Build the core client from CLI args + environment. `--mock` (or
 * `P4PILOT_MOCK=1`) uses an in-memory fake depot so the server runs with no
 * Perforce installed; otherwise a real `p4` runner is used.
 */
export function buildCore(argv: string[], env: NodeJS.ProcessEnv): BuiltCore {
  const config = loadConfig({ env });
  const mock = config.mock || argv.includes("--mock");
  if (mock) {
    const depot: FakeDepotState = { ...DEFAULT_MOCK_DEPOT, files: [...DEFAULT_MOCK_DEPOT.files] };
    return { client: new P4Client(new MockP4Runner(depot)), config, mock: true };
  }
  const client = new P4Client(new ExecaP4Runner({ p4Path: config.p4Path, env: cleanEnv(config.env) }));
  return { client, config, mock: false };
}
