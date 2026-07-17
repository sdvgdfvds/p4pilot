// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DemoProvider, useDemo } from "./useDemo.js";

function Probe() {
  const { files, ready, smartEdit } = useDemo();
  return (
    <div>
      <span data-testid="count">{ready ? files.length : -1}</span>
      <span data-testid="opened">{files.filter((f) => f.opened).length}</span>
      <button onClick={() => void smartEdit("/depot/game/src/main.cpp")}>edit</button>
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
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("4"));
    await act(async () => {
      screen.getByText("edit").click();
    });
    await waitFor(() => expect(screen.getByTestId("opened").textContent).toBe("1"));
  });
});
