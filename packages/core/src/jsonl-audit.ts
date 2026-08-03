import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { MemoryAuditSink, type AuditEvent, type AuditSink } from "./audit.js";
import { P4PilotError } from "./types.js";

export interface JsonlFileAuditSinkOptions {
  /** Path to the JSONL audit log file (resolved to absolute). */
  filePath: string;
  /** In-memory ring buffer size for {@link tail}. Default 1000. */
  maxEvents?: number;
}

/**
 * Durable audit sink that appends one JSON object per line to a local file.
 *
 * - Creates parent directories on first successful write attempt.
 * - Keeps an in-memory ring buffer for {@link tail} (same semantics as
 *   {@link MemoryAuditSink}).
 * - Constructor throws {@link P4PilotError} `INVALID_INPUT` if `filePath` is
 *   empty/whitespace.
 * - Runtime write failures are swallowed after the first failure so agent tools
 *   do not crash; subsequent records stay memory-only until process restart.
 *   (Sync `appendFileSync` is intentional for local-agent simplicity.)
 */
export class JsonlFileAuditSink implements AuditSink {
  /** Absolute path being written. */
  readonly filePath: string;

  private readonly events: AuditEvent[] = [];
  private readonly maxEvents: number;
  private writeFailed = false;
  private parentEnsured = false;

  constructor(opts: JsonlFileAuditSinkOptions) {
    const raw = opts.filePath?.trim() ?? "";
    if (raw.length === 0) {
      throw new P4PilotError(
        "audit log filePath must be a non-empty path",
        "INVALID_INPUT",
      );
    }
    this.filePath = resolve(raw);
    this.maxEvents = opts.maxEvents ?? 1_000;
  }

  record(event: AuditEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }

    if (this.writeFailed) return;

    try {
      if (!this.parentEnsured) {
        mkdirSync(dirname(this.filePath), { recursive: true });
        this.parentEnsured = true;
      }
      appendFileSync(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
    } catch {
      // Do not crash the agent on disk/permission errors; keep memory buffer.
      this.writeFailed = true;
    }
  }

  tail(limit?: number): AuditEvent[] {
    if (limit === undefined) return this.events.slice();
    if (limit <= 0) return [];
    return this.events.slice(-limit);
  }
}

/**
 * Build an {@link AuditSink} from environment variables.
 *
 * - If `P4PILOT_AUDIT_LOG` is a non-empty path → {@link JsonlFileAuditSink}
 * - Otherwise → {@link MemoryAuditSink}
 *
 * Node-only (uses filesystem for the JSONL sink). Not exported from browser entry.
 */
export function createAuditSinkFromEnv(env: NodeJS.ProcessEnv): AuditSink {
  const path = env.P4PILOT_AUDIT_LOG?.trim();
  if (path) {
    return new JsonlFileAuditSink({ filePath: path });
  }
  return new MemoryAuditSink();
}
