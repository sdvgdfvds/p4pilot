import type { AssetClassification, AssetGuardConfig } from "./asset-guard.js";
import { classifyAsset } from "./asset-guard.js";
import type { P4Client } from "./p4-client.js";
import type { P4Action } from "./types.js";

export type CheckoutStatus =
  "already-open" | "opened" | "added" | "skipped-untracked-ignored";

export interface CheckoutResult {
  path: string;
  status: CheckoutStatus;
  action?: P4Action;
  changelist?: string;
  asset?: AssetClassification;
}

/**
 * Ensure `localPath` is open for edit before an agent modifies it.
 *
 * fstat the file, then: already open → "already-open"; tracked in depot →
 * `p4 edit` → "opened"; otherwise (new file) → `p4 add` → "added". Attaches to
 * `opts.changelist` when provided, and classifies the file so hosts can warn
 * on binary edits.
 */
export async function ensureOpenForEdit(
  client: P4Client,
  localPath: string,
  opts?: { changelist?: string; assetConfig?: Partial<AssetGuardConfig> },
): Promise<CheckoutResult> {
  const [stat] = await client.fstat([localPath]);
  const asset = classifyAsset(localPath, { stat, config: opts?.assetConfig });
  const changelist = opts?.changelist;
  const openOpts = changelist === undefined ? undefined : { changelist };

  if (stat?.isOpened) {
    return {
      path: localPath,
      status: "already-open",
      action: stat.action,
      changelist,
      asset,
    };
  }

  if (stat?.isTracked) {
    const [opened] = await client.edit([localPath], openOpts);
    return {
      path: localPath,
      status: "opened",
      action: opened?.action ?? "edit",
      changelist: opened?.change ?? changelist,
      asset,
    };
  }

  const [added] = await client.add([localPath], openOpts);
  return {
    path: localPath,
    status: "added",
    action: added?.action ?? "add",
    changelist: added?.change ?? changelist,
    asset,
  };
}

/**
 * Batch variant. Preserves input order and never lets one bad file abort the
 * rest — a failure yields a `skipped-untracked-ignored` result for that path.
 */
export async function ensureOpenForEditMany(
  client: P4Client,
  localPaths: string[],
  opts?: { changelist?: string },
): Promise<CheckoutResult[]> {
  const results: CheckoutResult[] = [];
  for (const path of localPaths) {
    try {
      results.push(await ensureOpenForEdit(client, path, opts));
    } catch {
      results.push({ path, status: "skipped-untracked-ignored" });
    }
  }
  return results;
}
