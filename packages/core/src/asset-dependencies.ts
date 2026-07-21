import { P4PilotError } from "./types.js";

export type AssetDependencyDirection = "dependencies" | "referencers" | "both";

export interface AssetDependencyRecord {
  path: string;
  dependencies: string[];
  referencers: string[];
}

export interface AssetDependencyProvider {
  readonly name: string;
  getAsset(path: string): Promise<AssetDependencyRecord | undefined>;
}

export interface AssetDependencyLink {
  path: string;
  depth: number;
}

export interface AssetDependencyReport {
  path: string;
  provider: string;
  direction: AssetDependencyDirection;
  depth: number;
  directDependencies: string[];
  directReferencers: string[];
  dependencies: AssetDependencyLink[];
  referencers: AssetDependencyLink[];
  missingAssets: string[];
  risks: string[];
}

export class StaticAssetDependencyProvider implements AssetDependencyProvider {
  readonly name: string;
  readonly #records: Map<string, AssetDependencyRecord>;

  constructor(name: string, records: AssetDependencyRecord[]) {
    this.name = name;
    this.#records = new Map(
      records.map((record) => [
        record.path,
        {
          path: record.path,
          dependencies: [...record.dependencies],
          referencers: [...record.referencers],
        },
      ]),
    );
  }

  async getAsset(path: string): Promise<AssetDependencyRecord | undefined> {
    const record = this.#records.get(path);
    return record === undefined
      ? undefined
      : {
          path: record.path,
          dependencies: [...record.dependencies],
          referencers: [...record.referencers],
        };
  }
}

interface TraversalResult {
  links: AssetDependencyLink[];
  missing: Set<string>;
  cycles: Set<string>;
  depthLimitReached: boolean;
}

async function traverse(
  provider: AssetDependencyProvider,
  root: AssetDependencyRecord,
  relation: "dependencies" | "referencers",
  maxDepth: number,
): Promise<TraversalResult> {
  const links: AssetDependencyLink[] = [];
  const missing = new Set<string>();
  const cycles = new Set<string>();
  const visited = new Set([root.path]);
  const queue: Array<{
    record: AssetDependencyRecord;
    depth: number;
    ancestors: Set<string>;
  }> = [{ record: root, depth: 0, ancestors: new Set([root.path]) }];
  let depthLimitReached = false;

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const neighbors = current.record[relation];
    if (current.depth === maxDepth) {
      if (neighbors.length > 0) depthLimitReached = true;
      continue;
    }

    for (const path of neighbors) {
      if (current.ancestors.has(path)) {
        cycles.add(`${current.record.path} -> ${path}`);
        continue;
      }
      if (visited.has(path)) continue;
      visited.add(path);
      const depth = current.depth + 1;
      links.push({ path, depth });
      const record = await provider.getAsset(path);
      if (record === undefined) {
        missing.add(path);
      } else {
        queue.push({
          record,
          depth,
          ancestors: new Set([...current.ancestors, path]),
        });
      }
    }
  }

  return { links, missing, cycles, depthLimitReached };
}

export async function resolveAssetDependencies(
  provider: AssetDependencyProvider,
  path: string,
  opts?: { direction?: AssetDependencyDirection; depth?: number },
): Promise<AssetDependencyReport> {
  const direction = opts?.direction ?? "both";
  const depth = opts?.depth ?? 1;
  if (!Number.isInteger(depth) || depth < 1 || depth > 10) {
    throw new P4PilotError(
      "asset dependency depth must be an integer from 1 to 10",
      "INVALID_INPUT",
    );
  }

  const root = await provider.getAsset(path);
  if (root === undefined) {
    throw new P4PilotError(
      `asset ${path} is not present in the Asset Registry export`,
      "ASSET_NOT_FOUND",
    );
  }

  const dependencies =
    direction === "dependencies" || direction === "both"
      ? await traverse(provider, root, "dependencies", depth)
      : undefined;
  const referencers =
    direction === "referencers" || direction === "both"
      ? await traverse(provider, root, "referencers", depth)
      : undefined;
  const missingAssets = [
    ...(dependencies?.missing ?? []),
    ...(referencers?.missing ?? []),
  ].filter((value, index, values) => values.indexOf(value) === index);
  const cycles = [
    ...(dependencies?.cycles ?? []),
    ...(referencers?.cycles ?? []),
  ];
  const risks = [
    "Asset Registry data may omit references created only at runtime.",
  ];
  if (missingAssets.length > 0) {
    risks.push(`missing Asset Registry records: ${missingAssets.join(", ")}`);
  }
  if (cycles.length > 0) {
    risks.push(`cycle detected: ${cycles.join(", ")}`);
  }
  if (
    dependencies?.depthLimitReached === true ||
    referencers?.depthLimitReached === true
  ) {
    risks.push(`traversal stopped at depth ${depth}; deeper links may exist`);
  }

  return {
    path: root.path,
    provider: provider.name,
    direction,
    depth,
    directDependencies:
      direction === "dependencies" || direction === "both"
        ? [...root.dependencies]
        : [],
    directReferencers:
      direction === "referencers" || direction === "both"
        ? [...root.referencers]
        : [],
    dependencies: dependencies?.links ?? [],
    referencers: referencers?.links ?? [],
    missingAssets,
    risks,
  };
}
