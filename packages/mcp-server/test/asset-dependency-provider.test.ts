import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  JsonFileAssetDependencyProvider,
  UnavailableAssetDependencyProvider,
} from "../src/asset-dependency-provider.js";

describe("asset dependency providers", () => {
  const dirs: string[] = [];
  const fixture = (contents: unknown): string => {
    const dir = mkdtempSync(join(tmpdir(), "p4pilot-assets-"));
    dirs.push(dir);
    const path = join(dir, "asset-registry.json");
    writeFileSync(path, JSON.stringify(contents));
    return path;
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads a versioned Unreal Asset Registry JSON export", async () => {
    const path = fixture({
      version: 1,
      assets: [
        {
          path: "/Game/Hero",
          dependencies: ["/Game/Mesh"],
          referencers: ["/Game/Level"],
        },
      ],
    });
    const provider = new JsonFileAssetDependencyProvider(path);
    await expect(provider.getAsset("/Game/Hero")).resolves.toEqual({
      path: "/Game/Hero",
      dependencies: ["/Game/Mesh"],
      referencers: ["/Game/Level"],
    });
  });

  it("reports malformed exports as unavailable instead of inventing data", async () => {
    const provider = new JsonFileAssetDependencyProvider(
      fixture({ version: 1, assets: [{ path: "/Game/Hero" }] }),
    );
    await expect(provider.getAsset("/Game/Hero")).rejects.toMatchObject({
      code: "ASSET_DEPENDENCIES_UNAVAILABLE",
    });
  });

  it("reports an unconfigured provider explicitly", async () => {
    await expect(
      new UnavailableAssetDependencyProvider().getAsset("/Game/Hero"),
    ).rejects.toMatchObject({ code: "ASSET_DEPENDENCIES_UNAVAILABLE" });
  });
});
