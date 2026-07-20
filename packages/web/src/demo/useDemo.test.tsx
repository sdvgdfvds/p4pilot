// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DemoStore } from "./store.js";
import { DemoProvider, useDemo } from "./useDemo.js";

function Probe() {
  const { error, files, pending, ready, smartEdit } = useDemo();
  return (
    <div>
      <span data-testid="count">{ready ? files.length : -1}</span>
      <span data-testid="opened">{files.filter((f) => f.opened).length}</span>
      <span data-testid="error">{error ?? ""}</span>
      <span data-testid="pending">{pending.join(",")}</span>
      <button onClick={() => void smartEdit("/depot/game/src/main.cpp")}>
        edit
      </button>
    </div>
  );
}

describe("useDemo", () => {
  it("loads files and reflects a checkout", async () => {
    render(
      <DemoProvider>
        <Probe />
      </DemoProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("4"),
    );
    await act(async () => {
      screen.getByText("edit").click();
    });
    await waitFor(() =>
      expect(screen.getByTestId("opened").textContent).toBe("1"),
    );
  });

  it("surfaces action errors and suppresses duplicate in-flight operations", async () => {
    const store = new DemoStore();
    let rejectCheckout!: (reason: Error) => void;
    const checkout = vi.spyOn(store, "smartEdit").mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectCheckout = reject;
        }),
    );

    render(
      <DemoProvider store={store}>
        <Probe />
      </DemoProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("4"),
    );

    fireEvent.click(screen.getByText("edit"));
    fireEvent.click(screen.getByText("edit"));
    await waitFor(() =>
      expect(screen.getByTestId("pending").textContent).toContain(
        "smart-edit:",
      ),
    );
    expect(checkout).toHaveBeenCalledTimes(1);

    await act(async () => rejectCheckout(new Error("checkout unavailable")));
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe(
        "checkout unavailable",
      ),
    );
    expect(screen.getByTestId("pending").textContent).toBe("");
  });
});
