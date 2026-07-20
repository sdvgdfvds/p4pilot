import type { FakeDepotState } from "@p4pilot/core/browser";

export interface DemoSeed {
  depot: FakeDepotState;
  /** depotFile -> before/after text, so the review view can render a real diff. */
  contents: Record<string, { before: string; after: string }>;
}

export function makeSeed(): DemoSeed {
  const depot: FakeDepotState = {
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
  const contents: DemoSeed["contents"] = {
    "//depot/game/src/player.cpp": {
      before: "void Player::Update(float dt) {\n  Move(dt);\n}\n",
      after:
        "void Player::Update(float dt) {\n  Move(dt);\n  if (input.Pressed(Dash)) {\n    StartDash();\n  }\n}\n",
    },
  };
  return { depot, contents };
}
