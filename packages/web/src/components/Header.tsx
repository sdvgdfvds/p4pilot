import { Code2, Compass, ExternalLink } from "lucide-react";
import { useDemo } from "../demo/useDemo.js";

export function Header() {
  const { connection, ready } = useDemo();
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
