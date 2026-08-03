import type { PolicyAction } from "./policy.js";

export type AuditDecision = "deny" | "success" | "error";

export interface AuditEvent {
  id: string;
  timestamp: string;
  tool: string;
  action: PolicyAction;
  decision: AuditDecision;
  actor?: string;
  paths?: string[];
  changelist?: string;
  durationMs?: number;
  message?: string;
}

export interface AuditSink {
  record(event: AuditEvent): void;
  /** Most recent events, newest last. Defaults to all retained events. */
  tail(limit?: number): AuditEvent[];
}

export interface CreateAuditEventInput {
  tool: string;
  action: PolicyAction;
  decision: AuditDecision;
  actor?: string;
  paths?: string[];
  changelist?: string;
  durationMs?: number;
  message?: string;
  id?: string;
  timestamp?: string;
}

let auditSeq = 0;

function nextAuditId(): string {
  auditSeq += 1;
  return `audit-${Date.now()}-${auditSeq}`;
}

export function createAuditEvent(input: CreateAuditEventInput): AuditEvent {
  return {
    id: input.id ?? nextAuditId(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    tool: input.tool,
    action: input.action,
    decision: input.decision,
    ...(input.actor !== undefined ? { actor: input.actor } : {}),
    ...(input.paths !== undefined ? { paths: input.paths } : {}),
    ...(input.changelist !== undefined ? { changelist: input.changelist } : {}),
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
    ...(input.message !== undefined ? { message: input.message } : {}),
  };
}

/**
 * In-memory ring buffer of audit events for a single MCP server process.
 * Suitable for tests and local agent sessions; not durable across restarts.
 */
export class MemoryAuditSink implements AuditSink {
  private readonly events: AuditEvent[] = [];

  constructor(private readonly maxEvents = 1_000) {}

  record(event: AuditEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  tail(limit?: number): AuditEvent[] {
    if (limit === undefined) return this.events.slice();
    if (limit <= 0) return [];
    return this.events.slice(-limit);
  }

  clear(): void {
    this.events.length = 0;
  }
}
