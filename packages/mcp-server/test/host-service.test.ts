import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_ASSET_GUARD_CONFIG,
  P4Client,
  type P4PilotConfig,
} from "@p4pilot/core";
import { MockP4Runner } from "@p4pilot/core/testing";
import { afterEach, describe, expect, it } from "vitest";

import { createHostServer } from "../src/host-service.js";
import { parseHostArgs } from "../src/host-cli.js";

const config: P4PilotConfig = {
  p4Path: "p4",
  mock: true,
  assetGuard: DEFAULT_ASSET_GUARD_CONFIG,
  assetDependencies: {},
  defaultChangelistPrefix: "[p4pilot] ",
  env: {},
};

const seed = () =>
  new MockP4Runner({
    root: "/ws",
    user: "alice",
    client: "host-ws",
    files: [
      {
        depotFile: "//depot/a.c",
        clientFile: "/ws/a.c",
        headType: "text",
        headRev: 2,
        opened: { action: "edit", change: "42" },
      },
      {
        depotFile: "//depot/Hero.uasset",
        clientFile: "/ws/Hero.uasset",
        headType: "binary+l",
        headRev: 3,
      },
    ],
    changelists: [
      {
        change: "42",
        description: "host review",
        status: "pending",
        user: "alice",
        client: "host-ws",
        files: ["//depot/a.c"],
      },
    ],
  });

describe("localhost host service", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  async function start() {
    const webRoot = mkdtempSync(join(tmpdir(), "p4pilot-web-"));
    dirs.push(webRoot);
    writeFileSync(join(webRoot, "index.html"), "<main>p4pilot host</main>");
    const runner = seed();
    const server = createHostServer({
      client: new P4Client(runner),
      config,
      webRoot,
      mode: "live",
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("host service did not bind a TCP port");
    }
    return {
      baseUrl: `http://127.0.0.1:${address.port}`,
      close: () =>
        new Promise<void>((resolve) => server.close(() => resolve())),
      runner,
    };
  }

  it("serves live workspace, asset info, review, and static UI routes", async () => {
    const host = await start();
    try {
      const workspace = await fetch(`${host.baseUrl}/api/workspace`).then((r) =>
        r.json(),
      );
      expect(workspace).toMatchObject({
        connection: { mode: "live", workspace: "host-ws", user: "alice" },
      });
      expect(workspace.files).toEqual([
        expect.objectContaining({ depotFile: "//depot/a.c", opened: true }),
      ]);
      expect(workspace.changelists).toEqual([
        expect.objectContaining({ change: "42" }),
      ]);

      const asset = await fetch(
        `${host.baseUrl}/api/asset-info?path=${encodeURIComponent("/ws/Hero.uasset")}`,
      ).then((r) => r.json());
      expect(asset).toMatchObject({ kind: "large-asset", shouldRead: false });

      const review = await fetch(`${host.baseUrl}/api/review?change=42`).then(
        (r) => r.json(),
      );
      expect(review).toMatchObject({
        change: "42",
        files: [expect.objectContaining({ depotFile: "//depot/a.c" })],
      });

      await expect(
        fetch(`${host.baseUrl}/p4pilot/`).then((r) => r.text()),
      ).resolves.toContain("p4pilot host");
    } finally {
      await host.close();
    }
  });

  it("routes mutations and returns typed JSON errors", async () => {
    const host = await start();
    try {
      const revert = await fetch(`${host.baseUrl}/api/revert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "/ws/a.c" }),
      });
      expect(revert.ok).toBe(true);
      expect(host.runner.state.files[0]!.opened).toBeUndefined();

      const missing = await fetch(
        `${host.baseUrl}/api/asset-info?path=${encodeURIComponent("/ws/missing.uasset")}`,
      );
      expect(missing.status).toBe(404);
      await expect(missing.json()).resolves.toMatchObject({
        error: { code: "ASSET_NOT_FOUND" },
      });
    } finally {
      await host.close();
    }
  });
});

describe("host CLI", () => {
  it("parses loopback host options and rejects non-loopback binding", () => {
    expect(
      parseHostArgs(
        ["--host", "localhost", "--port", "4815", "--web-root", "web-dist"],
        "D:/repo",
      ),
    ).toEqual({
      host: "localhost",
      port: 4815,
      webRoot: "D:\\repo\\web-dist",
    });
    expect(() => parseHostArgs(["--host", "0.0.0.0"], "D:/repo")).toThrow(
      "loopback",
    );
  });
});
