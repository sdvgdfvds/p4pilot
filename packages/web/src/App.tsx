import { useState } from "react";
import { AlertCircle, GitPullRequest, LayoutDashboard, X } from "lucide-react";
import { Header } from "./components/Header.js";
import { Dashboard } from "./components/Dashboard.js";
import { ReviewView } from "./components/ReviewView.js";
import { HttpBackend } from "./backend/http-backend.js";
import type { P4PilotBackend } from "./backend/types.js";
import { DemoStore } from "./demo/store.js";
import { DemoProvider, useDemo } from "./demo/useDemo.js";

export function backendFromLocation(location: Location): P4PilotBackend {
  const configured = new URLSearchParams(location.search).get("backend");
  if (configured === null) return new DemoStore();
  const baseUrl = configured === "local" ? location.origin : configured;
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("backend URL must use http or https");
  }
  return new HttpBackend(url.origin);
}

function Workspace() {
  const [tab, setTab] = useState<"dashboard" | "review">("dashboard");
  const { clearError, error } = useDemo();
  return (
    <main className="app-shell" data-testid="app">
      <Header />
      <nav className="workspace-tabs" aria-label="Workspace views">
        <div className="workspace-inner">
          <button
            className={tab === "dashboard" ? "active" : undefined}
            aria-current={tab === "dashboard" ? "page" : undefined}
            onClick={() => setTab("dashboard")}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button
            className={tab === "review" ? "active" : undefined}
            aria-current={tab === "review" ? "page" : undefined}
            onClick={() => setTab("review")}
          >
            <GitPullRequest size={16} /> Review
          </button>
        </div>
      </nav>
      {error && (
        <div className="error-region">
          <div className="error-banner" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              title="Dismiss error"
              onClick={clearError}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      <div className="workspace-inner workspace-content">
        {tab === "dashboard" ? <Dashboard /> : <ReviewView />}
      </div>
    </main>
  );
}

export function App({ backend }: { backend?: P4PilotBackend }) {
  return (
    <DemoProvider store={backend ?? backendFromLocation(window.location)}>
      <Workspace />
    </DemoProvider>
  );
}
