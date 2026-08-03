// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../App.js";
import { DemoStore } from "../demo/store.js";
import { DemoProvider } from "../demo/useDemo.js";
import { AuditView } from "./AuditView.js";
import type { P4PilotBackend } from "../backend/types.js";

describe("AuditView", () => {
  it("renders seeded demo audit events", async () => {
    render(
      <DemoProvider>
        <AuditView />
      </DemoProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("audit-table")).toBeDefined(),
    );
    expect(screen.getByText("p4_smart_edit")).toBeDefined();
    expect(screen.getByText("p4_delete")).toBeDefined();
    expect(screen.getByText("p4_submit")).toBeDefined();
    expect(screen.getAllByText("allow").length).toBeGreaterThan(0);
    expect(screen.getAllByText("deny").length).toBeGreaterThanOrEqual(2);
  });

  it("shows an empty state when the backend has no events", async () => {
    const store = new DemoStore();
    vi.spyOn(store, "listAuditEvents").mockResolvedValue([]);
    render(
      <DemoProvider store={store}>
        <AuditView />
      </DemoProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("audit-empty")).toBeDefined(),
    );
    expect(screen.getByText("No audit events yet")).toBeDefined();
  });
});

describe("App Audit tab", () => {
  it("switches to Audit and shows seeded events", async () => {
    render(<App backend={new DemoStore()} />);
    fireEvent.click(screen.getByRole("button", { name: /Audit/i }));
    await waitFor(() =>
      expect(screen.getByTestId("audit-table")).toBeDefined(),
    );
    expect(screen.getByText("p4_smart_edit")).toBeDefined();
    expect(
      screen.getAllByText(/denied by policy "restricted-agent"/).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("surfaces listAuditEvents failures in the error banner", async () => {
    const backend = new DemoStore() as P4PilotBackend;
    vi.spyOn(backend, "listAuditEvents").mockRejectedValue(
      new Error("audit endpoint unavailable"),
    );
    render(<App backend={backend} />);
    fireEvent.click(screen.getByRole("button", { name: /Audit/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "audit endpoint unavailable",
      ),
    );
  });
});
