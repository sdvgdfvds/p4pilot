import { Code2, Compass, ExternalLink, Shield } from "lucide-react";
import { useDemo } from "../demo/useDemo.js";
import type { PolicyInfo } from "../backend/types.js";

/** Compact path-allowlist summary for the header badge. */
export function pathAllowlistSummary(
  pathAllowlist: string[] | null | undefined,
): string | null {
  if (pathAllowlist === null || pathAllowlist === undefined) return null;
  if (pathAllowlist.length === 0) return null;
  if (pathAllowlist.length === 1) return pathAllowlist[0]!;
  if (pathAllowlist.length === 2) {
    return `${pathAllowlist[0]}, ${pathAllowlist[1]}`;
  }
  return `${pathAllowlist[0]} +${pathAllowlist.length - 1} more`;
}

function PolicyStatus({ policy }: { policy: PolicyInfo }) {
  const allowlist = pathAllowlistSummary(policy.pathAllowlist);
  return (
    <div
      className="policy-status"
      data-testid="policy-status"
      title={
        allowlist
          ? `Policy ${policy.name} · path allowlist: ${policy.pathAllowlist?.join(", ")}`
          : `Policy ${policy.name} · no path allowlist`
      }
    >
      <span className="policy-badge" data-testid="policy-name">
        <Shield size={13} aria-hidden="true" />
        {policy.name}
      </span>
      {!policy.submitAllowed && (
        <span className="policy-submit-blocked" data-testid="submit-blocked">
          submit blocked
        </span>
      )}
      {allowlist && (
        <span className="policy-allowlist" data-testid="path-allowlist">
          paths: {allowlist}
        </span>
      )}
    </div>
  );
}

export function Header() {
  const { connection, ready, policy } = useDemo();
  const status = !ready
    ? "Connecting"
    : connection === null
      ? "Disconnected"
      : connection.mode === "live"
        ? `Live · ${connection.workspace}`
        : "Real core · mock depot";
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Compass size={22} />
          </span>
          <div>
            <h1>p4pilot</h1>
            <p>Perforce workspace control for coding agents</p>
          </div>
        </div>
        <div className="header-actions">
          {policy && <PolicyStatus policy={policy} />}
          <span
            className={`runtime-status ${ready && connection === null ? "disconnected" : ""}`}
          >
            <span aria-hidden="true" />
            {status}
          </span>
          <a
            className="repo-link"
            href="https://github.com/sdvgdfvds/p4pilot"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={16} /> Repository <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </header>
  );
}
