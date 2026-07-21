import { readFile } from "node:fs/promises";

import {
  P4PilotError,
  StaticAssetDependencyProvider,
  type AssetDependencyProvider,
  type P4PilotConfig,
} from "@p4pilot/core";
import { z } from "zod";

const exportSchema = z.object({
  version: z.literal(1),
  assets: z.array(
    z.object({
      path: z.string().min(1),
      dependencies: z.array(z.string().min(1)),
      referencers: z.array(z.string().min(1)),
    }),
  ),
});

export class JsonFileAssetDependencyProvider implements AssetDependencyProvider {
  readonly name: string;
  readonly #path: string;
  #loaded?: Promise<StaticAssetDependencyProvider>;

  constructor(path: string) {
    this.#path = path;
    this.name = `unreal-asset-registry:${path}`;
  }

  async getAsset(path: string) {
    this.#loaded ??= this.#load();
    return (await this.#loaded).getAsset(path);
  }

  async #load(): Promise<StaticAssetDependencyProvider> {
    try {
      const text = await readFile(this.#path, "utf8");
      const parsed = exportSchema.parse(JSON.parse(text));
      return new StaticAssetDependencyProvider(this.name, parsed.assets);
    } catch (error) {
      throw new P4PilotError(
        `Unreal Asset Registry export is unavailable: ${this.#path}`,
        "ASSET_DEPENDENCIES_UNAVAILABLE",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

export class UnavailableAssetDependencyProvider implements AssetDependencyProvider {
  readonly name = "unavailable";

  async getAsset(): Promise<undefined> {
    throw new P4PilotError(
      "Unreal asset dependencies are unavailable; configure P4PILOT_UE_ASSET_REGISTRY_JSON",
      "ASSET_DEPENDENCIES_UNAVAILABLE",
    );
  }
}

export function createAssetDependencyProvider(
  config: P4PilotConfig,
  opts?: { mock?: boolean },
): AssetDependencyProvider {
  if (config.assetDependencies.registryJsonPath) {
    return new JsonFileAssetDependencyProvider(
      config.assetDependencies.registryJsonPath,
    );
  }
  if (opts?.mock) {
    return new StaticAssetDependencyProvider("p4pilot-mock-asset-registry", [
      {
        path: "/Game/Hero",
        dependencies: ["/Game/HeroMesh", "/Game/HeroAnimation"],
        referencers: ["/Game/Maps/Arena"],
      },
      {
        path: "/Game/HeroMesh",
        dependencies: ["/Game/Materials/Hero"],
        referencers: ["/Game/Hero"],
      },
      {
        path: "/Game/HeroAnimation",
        dependencies: [],
        referencers: ["/Game/Hero"],
      },
      {
        path: "/Game/Materials/Hero",
        dependencies: [],
        referencers: ["/Game/HeroMesh"],
      },
      {
        path: "/Game/Maps/Arena",
        dependencies: ["/Game/Hero"],
        referencers: [],
      },
    ]);
  }
  return new UnavailableAssetDependencyProvider();
}
