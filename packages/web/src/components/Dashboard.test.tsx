// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoProvider } from "../demo/useDemo.js";
import { Dashboard } from "./Dashboard.js";

function renderDashboard() {
  return render(
    <DemoProvider>
      <Dashboard />
    </DemoProvider>,
  );
}

describe("Dashboard", () => {
  it("shows the large-asset badge and a withheld-content card", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getAllByText("large-asset").length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Asset info" })[0]!);
    await waitFor(() => expect(screen.getByTestId("asset-info")).toBeDefined());
    expect(screen.getByText(/content withheld/i)).toBeDefined();
  });

  it("creates a changelist", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByLabelText("new changelist")).toBeDefined(),
    );
    fireEvent.change(screen.getByLabelText("new changelist"), {
      target: { value: "dash tuning" },
    });
    fireEvent.click(screen.getByText("Create CL"));
    await waitFor(() =>
      expect(screen.getByText(/\[p4pilot\] dash tuning/)).toBeDefined(),
    );
  });

  it("reverts an opened file", async () => {
    renderDashboard();
    const path = "//depot/game/src/main.cpp";
    await waitFor(() => expect(screen.getByText(path)).toBeDefined());

    const row = screen.getByText(path).closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(
      within(row!).getByRole("button", { name: "Smart checkout" }),
    );

    await waitFor(() =>
      expect(
        within(row!).getByRole("button", { name: "Revert" }),
      ).toBeDefined(),
    );
    fireEvent.click(within(row!).getByRole("button", { name: "Revert" }));

    await waitFor(() =>
      expect(
        within(row!).getByRole("button", { name: "Smart checkout" }),
      ).toBeDefined(),
    );
    expect(within(row!).getByText("Not opened")).toBeDefined();
  });
});
