// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { DemoStore } from "./demo/store.js";

describe("App", () => {
  it("renders", () => {
    render(<App />);
    expect(screen.getByTestId("app")).toBeDefined();
  });

  it("shows an explicit disconnected state when the local host fails", async () => {
    const backend = new DemoStore();
    vi.spyOn(backend, "getWorkspace").mockRejectedValue(
      new Error("p4pilot host disconnected"),
    );
    render(<App backend={backend} />);
    await waitFor(() =>
      expect(screen.getAllByText("Disconnected").length).toBeGreaterThan(0),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "p4pilot host disconnected",
    );
  });
});
