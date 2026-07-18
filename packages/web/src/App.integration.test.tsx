// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("App integration", () => {
  it("switches between dashboard and review", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getAllByText("large-asset").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText("Review"));
    await waitFor(() => expect(screen.getByLabelText("pick changelist")).toBeDefined());
  });
});
