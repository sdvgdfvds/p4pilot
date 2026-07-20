// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoProvider } from "../demo/useDemo.js";
import { ReviewView } from "./ReviewView.js";

describe("ReviewView", () => {
  it("renders a real diff for the pending changelist", async () => {
    render(
      <DemoProvider>
        <ReviewView />
      </DemoProvider>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("pick changelist")).toBeDefined(),
    );
    fireEvent.change(screen.getByLabelText("pick changelist"), {
      target: { value: "812" },
    });
    await waitFor(() => expect(screen.getByTestId("diff")).toBeDefined());
    expect(screen.getByText(/StartDash/)).toBeDefined();
  });

  it("clears the diff when the changelist is deselected", async () => {
    render(
      <DemoProvider>
        <ReviewView />
      </DemoProvider>,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("pick changelist")).toBeDefined(),
    );
    fireEvent.change(screen.getByLabelText("pick changelist"), {
      target: { value: "812" },
    });
    await waitFor(() => expect(screen.getByTestId("diff")).toBeDefined());
    expect(screen.getByText(/StartDash/)).toBeDefined();

    fireEvent.change(screen.getByLabelText("pick changelist"), {
      target: { value: "" },
    });

    await waitFor(() => expect(screen.queryByTestId("diff")).toBeNull());
    expect(screen.queryByText(/StartDash/)).toBeNull();
  });
});
