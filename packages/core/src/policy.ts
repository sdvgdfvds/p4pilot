import { classifyAsset } from "./asset-guard.js";
import { P4PilotError } from "./types.js";

/**
 * High-level actions that safety policies can allow or deny.
 * Tool handlers map onto these; `submit` is never exposed as an MCP tool but
 * remains a first-class action so policy checks always reject it.
 */
export type PolicyAction =
  | "read"
  | "edit"
  | "add"
  | "delete"
  | "revert"
  | "sync"
  | "reopen"
  | "changelist_create"
  | "changelist_list"
  | "submit"
  | "audit_tail";

export interface SafetyPolicy {
  /** Stable policy id (e.g. `default`, `restricted-agent`, `read-only`). */
  name: string;
  /** Actions this policy permits. Anything not listed is denied. */
  allowedActions: ReadonlySet<PolicyAction>;
  /**
   * When true, edit/add/reopen on binary or large-asset paths are denied
   * (uses {@link classifyAsset}).
   */
  protectBinaryAssets: boolean;
}

export interface PolicyCheckContext {
  paths?: string[];
  changelist?: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  action: PolicyAction;
  reason?: string;
}

const ALL_EXCEPT_SUBMIT: readonly PolicyAction[] = [
  "read",
  "edit",
  "add",
  "delete",
  "revert",
  "sync",
  "reopen",
  "changelist_create",
  "changelist_list",
  "audit_tail",
];

const PATH_MUTATIONS = new Set<PolicyAction>(["edit", "add", "reopen"]);

/** Default operator policy: full workspace tooling, never submit. */
export const DEFAULT_SAFETY_POLICY: SafetyPolicy = {
  name: "default",
  allowedActions: new Set(ALL_EXCEPT_SUBMIT),
  protectBinaryAssets: false,
};

/**
 * Restricted agent policy: agents may prepare edits/changelists but cannot
 * delete, sync (workspace-wide mutation), or submit. Binary/large assets are
 * protected from open-for-edit.
 */
export const RESTRICTED_AGENT_POLICY: SafetyPolicy = {
  name: "restricted-agent",
  allowedActions: new Set<PolicyAction>([
    "read",
    "edit",
    "add",
    "revert",
    "reopen",
    "changelist_create",
    "changelist_list",
    "audit_tail",
  ]),
  protectBinaryAssets: true,
};

/** Read-only policy: inspection and audit only. */
export const READ_ONLY_POLICY: SafetyPolicy = {
  name: "read-only",
  allowedActions: new Set<PolicyAction>([
    "read",
    "changelist_list",
    "audit_tail",
  ]),
  protectBinaryAssets: true,
};

export function checkPolicy(
  policy: SafetyPolicy,
  action: PolicyAction,
  context?: PolicyCheckContext,
): PolicyCheckResult {
  // Submit is a hard product boundary regardless of the allow-list.
  if (action === "submit") {
    return {
      allowed: false,
      action,
      reason:
        "submit is not permitted by p4pilot safety policy (human submit boundary)",
    };
  }
  if (!policy.allowedActions.has(action)) {
    return {
      allowed: false,
      action,
      reason: `action "${action}" is denied by policy "${policy.name}"`,
    };
  }
  if (
    policy.protectBinaryAssets &&
    PATH_MUTATIONS.has(action) &&
    context?.paths?.length
  ) {
    for (const path of context.paths) {
      const classification = classifyAsset(path);
      if (!classification.shouldRead) {
        return {
          allowed: false,
          action,
          reason: `binary/large-asset path denied by policy "${policy.name}": ${path} (${classification.reason})`,
        };
      }
    }
  }
  return { allowed: true, action };
}

/** Throws {@link P4PilotError} with code `POLICY_DENIED` when disallowed. */
export function assertPolicyAllowed(
  policy: SafetyPolicy,
  action: PolicyAction,
  context?: PolicyCheckContext,
): void {
  const result = checkPolicy(policy, action, context);
  if (!result.allowed) {
    throw new P4PilotError(
      result.reason ?? `action "${action}" denied by policy "${policy.name}"`,
      "POLICY_DENIED",
      `policy=${policy.name} action=${action}`,
    );
  }
}
