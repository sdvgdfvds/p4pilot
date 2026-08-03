import {
  checkPolicy,
  createAuditEvent,
  type PolicyAction,
} from "@p4pilot/core";

import type { ToolContext, ToolResult } from "./tools.js";

export interface ToolPolicyMeta {
  tool: string;
  action: PolicyAction;
  paths?: string[];
  changelist?: string;
}

function fail(textValue: string): ToolResult {
  return { content: [{ type: "text", text: textValue }], isError: true };
}

/**
 * Enforce {@link ToolContext.policy} before running a tool handler and write a
 * compact audit record for every invocation (deny / success / error).
 *
 * Policy denials return an `isError` tool result — they never throw uncaught.
 */
export async function withPolicyAndAudit(
  ctx: ToolContext,
  meta: ToolPolicyMeta,
  fn: () => Promise<ToolResult>,
): Promise<ToolResult> {
  const decision = checkPolicy(ctx.policy, meta.action, {
    paths: meta.paths,
    changelist: meta.changelist,
  });

  if (!decision.allowed) {
    const message =
      decision.reason ??
      `action "${meta.action}" denied by policy "${ctx.policy.name}"`;
    ctx.audit.record(
      createAuditEvent({
        tool: meta.tool,
        action: meta.action,
        decision: "deny",
        actor: ctx.actor,
        paths: meta.paths,
        changelist: meta.changelist,
        message,
      }),
    );
    return fail(`p4pilot error [POLICY_DENIED]: ${message}`);
  }

  const started = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - started;
    const text = result.content[0]?.text;
    ctx.audit.record(
      createAuditEvent({
        tool: meta.tool,
        action: meta.action,
        decision: result.isError ? "error" : "success",
        actor: ctx.actor,
        paths: meta.paths,
        changelist: meta.changelist,
        durationMs,
        ...(result.isError && text !== undefined
          ? { message: text.slice(0, 200) }
          : {}),
      }),
    );
    return result;
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    ctx.audit.record(
      createAuditEvent({
        tool: meta.tool,
        action: meta.action,
        decision: "error",
        actor: ctx.actor,
        paths: meta.paths,
        changelist: meta.changelist,
        durationMs,
        message: message.slice(0, 200),
      }),
    );
    throw error;
  }
}
