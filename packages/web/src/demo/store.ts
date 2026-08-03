import {
  buildChangelistDescription,
  classifyAsset,
  ensureOpenForEditMany,
  MockP4Runner,
  P4Client,
  type ChangelistSummary,
  type CheckoutResult,
} from "@p4pilot/core/browser";
import type {
  AssetInfoData,
  AuditEvent,
  FileView,
  P4PilotBackend,
  PolicyInfo,
  ReviewData,
  WorkspaceSnapshot,
} from "../backend/types.js";
import { toDiffRows } from "../diff.js";
import { makeSeed, type DemoSeed } from "./seed.js";

export type {
  AssetInfoData,
  AuditEvent,
  FileView,
  PolicyInfo,
  ReviewData,
} from "../backend/types.js";

/**
 * Fixed offline demo policy — mirrors restricted-agent with a sample path
 * allowlist so the header badge is meaningful without a host.
 */
export const DEMO_POLICY: PolicyInfo = {
  name: "restricted-agent",
  allowedActions: [
    "read",
    "edit",
    "add",
    "revert",
    "reopen",
    "changelist_create",
    "changelist_list",
    "audit_tail",
  ],
  protectBinaryAssets: true,
  pathAllowlist: ["//depot/game/src", "/depot/game/src"],
  submitAllowed: false,
};

/** Fixed demo timestamps so tests stay stable. */
function seedAuditEvents(): AuditEvent[] {
  return [
    {
      id: "demo-audit-1",
      timestamp: "2026-07-30T14:02:11.000Z",
      tool: "p4_smart_edit",
      action: "edit",
      decision: "success",
      actor: "demo-agent",
      paths: ["/depot/game/src/player.cpp"],
      changelist: "812",
      durationMs: 42,
      message: "allowed smart_edit on text path",
      reason: "allowed smart_edit on text path",
    },
    {
      id: "demo-audit-2",
      timestamp: "2026-07-30T14:03:04.000Z",
      tool: "p4_delete",
      action: "delete",
      decision: "deny",
      actor: "demo-agent",
      paths: ["/depot/game/src/legacy.cpp"],
      message: 'action "delete" denied by policy "restricted-agent"',
      reason: 'action "delete" denied by policy "restricted-agent"',
    },
    {
      id: "demo-audit-3",
      timestamp: "2026-07-30T14:03:18.000Z",
      tool: "p4_submit",
      action: "submit",
      decision: "deny",
      actor: "demo-agent",
      changelist: "812",
      message: 'action "submit" denied by policy "restricted-agent"',
      reason: 'action "submit" denied by policy "restricted-agent"',
    },
  ];
}

export class DemoStore implements P4PilotBackend {
  readonly #seed: DemoSeed;
  readonly #client: P4Client;
  readonly #auditEvents: AuditEvent[];

  constructor() {
    this.#seed = makeSeed();
    this.#client = new P4Client(new MockP4Runner(this.#seed.depot));
    this.#auditEvents = seedAuditEvents();
  }

  async getWorkspace(): Promise<WorkspaceSnapshot> {
    const [files, changelists] = await Promise.all([
      this.listFiles(),
      this.listChangelists(),
    ]);
    return {
      connection: {
        mode: "mock",
        workspace: this.#seed.depot.client ?? "p4pilot-demo",
        user: this.#seed.depot.user,
        root: this.#seed.depot.root,
      },
      files,
      changelists,
    };
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

  async listAuditEvents(limit?: number): Promise<AuditEvent[]> {
    if (limit === undefined) return this.#auditEvents.slice();
    if (limit <= 0) return [];
    return this.#auditEvents.slice(-limit);
  }

  async getPolicy(): Promise<PolicyInfo> {
    return {
      ...DEMO_POLICY,
      allowedActions: [...DEMO_POLICY.allowedActions],
      pathAllowlist:
        DEMO_POLICY.pathAllowlist === null
          ? null
          : [...DEMO_POLICY.pathAllowlist],
    };
  }

  #openedChange(depotFile: string): string | undefined {
    return this.#seed.depot.files.find((f) => f.depotFile === depotFile)?.opened
      ?.change;
  }
}
