import type { AssetKind, ChangelistSummary } from "@p4pilot/core/browser";
import type { DiffRow } from "../diff.js";

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

export interface BackendConnection {
  mode: "mock" | "live";
  workspace: string;
  user?: string;
  root?: string;
}

export interface WorkspaceSnapshot {
  connection: BackendConnection;
  files: FileView[];
  changelists: ChangelistSummary[];
}

export interface P4PilotBackend {
  getWorkspace(): Promise<WorkspaceSnapshot>;
  smartEdit(clientFile: string, changelist?: string): Promise<unknown>;
  createChangelist(description: string): Promise<string>;
  revert(clientFile: string): Promise<unknown>;
  assetInfo(path: string): Promise<AssetInfoData>;
  review(change: string): Promise<ReviewData>;
}
