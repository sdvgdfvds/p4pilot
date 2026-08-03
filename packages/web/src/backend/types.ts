import type {
  AssetKind,
  AuditEvent as CoreAuditEvent,
  ChangelistSummary,
  PolicyAction,
} from "@p4pilot/core/browser";
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

/**
 * Web-facing audit event. Mirrors host `GET /api/audit` / core AuditEvent.
 * UI labels `success` as "allow"; core uses deny | success | error.
 */
export interface AuditEvent {
  id: string;
  timestamp: string;
  tool: string;
  action: PolicyAction | string;
  decision: "deny" | "success" | "error" | "allow";
  actor?: string;
  paths?: string[];
  changelist?: string;
  durationMs?: number;
  /** Human-readable reason (host/core field `message`). */
  message?: string;
  reason?: string;
}

export type { CoreAuditEvent };

export interface BackendConnection {
  mode: "mock" | "live";
  workspace: string;
  user?: string;
  root?: string;
}

/**
 * Active host safety policy (host `GET /api/policy`). Read-only status for the
 * web UI — submit is always reported as blocked.
 */
export interface PolicyInfo {
  name: string;
  allowedActions: string[];
  protectBinaryAssets: boolean;
  pathAllowlist: string[] | null;
  submitAllowed: false;
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
  /** Recent policy/tool audit events, newest last. */
  listAuditEvents(limit?: number): Promise<AuditEvent[]>;
  /** Active safety policy for the status badge (host `GET /api/policy`). */
  getPolicy(): Promise<PolicyInfo>;
}
