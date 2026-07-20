import {
  buildChangelistDescription,
  classifyAsset,
  ensureOpenForEditMany,
  MockP4Runner,
  P4Client,
  type AssetKind,
  type ChangelistSummary,
  type CheckoutResult,
} from "@p4pilot/core/browser";
import { toDiffRows, type DiffRow } from "../diff.js";
import { makeSeed, type DemoSeed } from "./seed.js";

export interface FileView {
  depotFile: string;
  clientFile: string;
  kind: AssetKind;
  shouldRead: boolean;
  opened: boolean;
  action?: string;
  change?: string;
  headRev?: number;
}

export interface ReviewData {
  change: string;
  description: string;
  user?: string;
  files: { depotFile: string; action: string; rows: DiffRow[] }[];
}

export interface AssetInfoData {
  path: string;
  kind: AssetKind;
  filetype?: string;
  tracked: boolean;
  headRev?: number;
  shouldRead: boolean;
  reason: string;
}

export class DemoStore {
  readonly #seed: DemoSeed;
  readonly #client: P4Client;

  constructor() {
    this.#seed = makeSeed();
    this.#client = new P4Client(new MockP4Runner(this.#seed.depot));
  }

  async listFiles(): Promise<FileView[]> {
    const stats = await this.#client.fstat(
      this.#seed.depot.files.map((f) => f.clientFile),
    );
    return stats.map((stat) => {
      const path = stat.clientFile ?? stat.depotFile;
      const asset = classifyAsset(path, { stat });
      return {
        depotFile: stat.depotFile,
        clientFile: stat.clientFile ?? stat.depotFile,
        kind: asset.kind,
        shouldRead: asset.shouldRead,
        opened: stat.isOpened,
        action: stat.action,
        change: stat.isOpened ? this.#openedChange(stat.depotFile) : undefined,
        headRev: stat.headRev,
      };
    });
  }

  async smartEdit(
    clientFile: string,
    changelist?: string,
  ): Promise<CheckoutResult> {
    const [result] = await ensureOpenForEditMany(
      this.#client,
      [clientFile],
      changelist === undefined ? undefined : { changelist },
    );
    return result!;
  }

  async createChangelist(description: string): Promise<string> {
    return this.#client.newChangelist(
      buildChangelistDescription(description, "[p4pilot] "),
    );
  }

  async listChangelists(): Promise<ChangelistSummary[]> {
    return this.#client.changes({ status: "pending" });
  }

  async revert(clientFile: string): Promise<string[]> {
    return this.#client.revert([clientFile]);
  }

  async assetInfo(path: string): Promise<AssetInfoData> {
    const [stat] = await this.#client.fstat([path]);
    const asset = classifyAsset(path, { stat });
    return {
      path,
      kind: asset.kind,
      filetype: asset.filetype,
      tracked: stat?.isTracked ?? false,
      headRev: stat?.headRev,
      shouldRead: asset.shouldRead,
      reason: asset.reason,
    };
  }

  async review(change: string): Promise<ReviewData> {
    const described = await this.#client.describe(change, { diff: true });
    return {
      change: described.change,
      description: described.description,
      user: described.user,
      files: described.files.map((file) => {
        const content = this.#seed.contents[file.depotFile];
        return {
          depotFile: file.depotFile,
          action: file.action,
          rows: content ? toDiffRows(content.before, content.after) : [],
        };
      }),
    };
  }

  #openedChange(depotFile: string): string | undefined {
    return this.#seed.depot.files.find((f) => f.depotFile === depotFile)?.opened
      ?.change;
  }
}
