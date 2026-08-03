import { useCallback, useEffect, useState } from "react";
import {
  ClipboardList,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { operationKey, useDemo } from "../demo/useDemo.js";
import type { AuditEvent } from "../backend/types.js";

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function decisionLabel(decision: AuditEvent["decision"]): string {
  if (decision === "success") return "allow";
  return decision;
}

function reasonText(event: AuditEvent): string {
  return event.reason ?? event.message ?? "—";
}

export function AuditView() {
  const { listAuditEvents, pending } = useDemo();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const loading = pending.includes(operationKey.listAudit);

  const refresh = useCallback(async () => {
    const next = await listAuditEvents(100);
    if (next !== undefined) setEvents(next);
  }, [listAuditEvents]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="audit-view" aria-labelledby="audit-heading">
      <div className="section-heading audit-heading">
        <div>
          <h2 id="audit-heading">Policy audit</h2>
          <p>Recent agent tool decisions from the host audit log</p>
        </div>
        <button
          type="button"
          className="command-button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh audit events"
        >
          {loading ? (
            <LoaderCircle className="spin" size={16} aria-hidden="true" />
          ) : (
            <RefreshCw size={16} aria-hidden="true" />
          )}
          Refresh
        </button>
      </div>

      {events === null && loading && (
        <div className="loading-state" role="status">
          <LoaderCircle className="spin" size={20} aria-hidden="true" />
          Loading audit events
        </div>
      )}

      {events !== null && events.length === 0 && (
        <div className="empty-state" data-testid="audit-empty">
          <ShieldAlert size={28} aria-hidden="true" />
          <strong>No audit events yet</strong>
          <span>Agent policy decisions will appear here after tool calls</span>
        </div>
      )}

      {events !== null && events.length > 0 && (
        <div className="table-shell audit-table-shell">
          <table data-testid="audit-table" aria-label="Audit events">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Decision</th>
                <th scope="col">Tool</th>
                <th scope="col">Action</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {[...events].reverse().map((event) => (
                <tr key={event.id} data-decision={event.decision}>
                  <td className="audit-time">
                    <time dateTime={event.timestamp}>
                      {formatTime(event.timestamp)}
                    </time>
                  </td>
                  <td>
                    <span className={`badge audit-decision ${event.decision}`}>
                      {decisionLabel(event.decision)}
                    </span>
                  </td>
                  <td className="audit-tool">{event.tool}</td>
                  <td className="audit-action">{event.action}</td>
                  <td className="audit-reason">{reasonText(event)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {events === null && !loading && (
        <div className="empty-state">
          <ClipboardList size={28} aria-hidden="true" />
          <strong>Audit log unavailable</strong>
          <span>Use Refresh to retry loading events</span>
        </div>
      )}
    </section>
  );
}
