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
  | "shelve"
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
  /**
   * If non-empty, actions that supply paths must have every path match at
   * least one prefix (after normalizing separators). Empty/undefined = no
   * path restriction. Path-based mutating actions also require a non-empty
   * `paths` list when this is set.
   */
  pathAllowlist?: readonly string[];
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
  "shelve",
  "audit_tail",
];

/** Mutations that open/touch files — subject to binary-asset protection. */
const PATH_MUTATIONS = new Set<PolicyAction>(["edit", "add", "reopen"]);

/**
 * Mutating actions that operate on depot/workspace paths. When
 * `pathAllowlist` is non-empty these require a non-empty `paths` list and
 * every path must match the allowlist.
 */
const PATH_BASED_MUTATIONS = new Set<PolicyAction>([
  "edit",
  "add",
  "delete",
  "revert",
  "sync",
  "reopen",
]);

/** Default operator policy: full workspace tooling, never submit. */
export const DEFAULT_SAFETY_POLICY: SafetyPolicy = {
  name: "default",
  allowedActions: new Set(ALL_EXCEPT_SUBMIT),
  protectBinaryAssets: false,
};

/**
 * Restricted agent policy: agents may prepare edits/changelists (including
 * shelving for human review) but cannot delete, sync (workspace-wide
 * mutation), or submit. Binary/large assets are protected from open-for-edit.
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
    "shelve",
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

/** Normalize path separators for allowlist prefix matching (`\` → `/`). */
export function normalizePolicyPath(path: string): string {
  return path.replaceAll("\\", "/");
}

/**
 * True when `path` equals a prefix or is nested under it (after separator
 * normalization). Sibling paths that only share a string prefix (e.g.
 * `//depot/src` vs `//depot/src2`) do not match.
 */
export function pathMatchesAllowlist(
  path: string,
  allowlist: readonly string[],
): boolean {
  const normalized = normalizePolicyPath(path);
  for (const raw of allowlist) {
    const prefix = normalizePolicyPath(raw).replace(/\/+$/, "");
    if (prefix.length === 0) continue;
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

/**
 * Return a copy of `basePolicy` with `pathAllowlist` set to `prefixes`.
 * Empty `prefixes` clears the allowlist (no path restriction).
 */
export function withPathAllowlist(
  basePolicy: SafetyPolicy,
  prefixes: readonly string[],
): SafetyPolicy {
  const cleaned = prefixes.map((p) => p.trim()).filter((p) => p.length > 0);
  if (cleaned.length === 0) {
    if (basePolicy.pathAllowlist === undefined) {
      return basePolicy;
    }
    return {
      name: basePolicy.name,
      allowedActions: basePolicy.allowedActions,
      protectBinaryAssets: basePolicy.protectBinaryAssets,
    };
  }
  return {
    ...basePolicy,
    pathAllowlist: Object.freeze([...cleaned]),
  };
}

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

  const allowlist = policy.pathAllowlist;
  if (allowlist !== undefined && allowlist.length > 0) {
    const paths = context?.paths;
    const hasPaths = paths !== undefined && paths.length > 0;

    if (PATH_BASED_MUTATIONS.has(action) && !hasPaths) {
      return {
        allowed: false,
        action,
        reason: `action "${action}" requires paths when pathAllowlist is set on policy "${policy.name}"`,
      };
    }

    if (hasPaths) {
      for (const path of paths) {
        if (!pathMatchesAllowlist(path, allowlist)) {
          return {
            allowed: false,
            action,
            reason: `path outside pathAllowlist of policy "${policy.name}": ${path}`,
          };
        }
      }
    }
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
