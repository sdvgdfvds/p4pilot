import { useState } from "react";
import { Header } from "./components/Header.js";
import { Dashboard } from "./components/Dashboard.js";
import { ReviewView } from "./components/ReviewView.js";
import { DemoProvider } from "./demo/useDemo.js";

export function App() {
  const [tab, setTab] = useState<"dashboard" | "review">("dashboard");
  return (
    <DemoProvider>
      <main data-testid="app">
        <Header />
        <nav>
          <button onClick={() => setTab("dashboard")} disabled={tab === "dashboard"}>Dashboard</button>
          <button onClick={() => setTab("review")} disabled={tab === "review"}>Review</button>
        </nav>
        {tab === "dashboard" ? <Dashboard /> : <ReviewView />}
      </main>
    </DemoProvider>
  );
}
