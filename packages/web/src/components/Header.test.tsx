// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../App.js";
import { DemoStore } from "../demo/store.js";
import { DemoProvider } from "../demo/useDemo.js";
import type { P4PilotBackend, PolicyInfo } from "../backend/types.js";
import { Header, pathAllowlistSummary } from "./Header.js";

describe("pathAllowlistSummary", () => {
  it("formats zero, one, two, and many prefixes", () => {
    expect(pathAllowlistSummary(null)).toBeNull();
    expect(pathAllowlistSummary([])).toBeNull();
    expect(pathAllowlistSummary(["//depot/src"])).toBe("//depot/src");
    expect(pathAllowlistSummary(["//a", "//b"])).toBe("//a, //b");
    expect(pathAllowlistSummary(["//a", "//b", "//c"])).toBe("//a +2 more");
  });
});

describe("Header policy status", () => {
  it("shows the demo policy name badge, submit blocked, and path allowlist", async () => {
    render(
      <DemoProvider>
        <Header />
      </DemoProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("policy-status")).toBeDefined(),
    );
    expect(screen.getByTestId("policy-name").textContent).toContain(
      "restricted-agent",
    );
    expect(screen.getByTestId("submit-blocked").textContent).toContain(
      "submit blocked",
    );
    expect(screen.getByTestId("path-allowlist").textContent).toMatch(
      /paths:.*\/\/depot\/game\/src/,
    );
  });

  it("hides policy status when getPolicy fails with workspace load", async () => {
    const backend = new DemoStore() as P4PilotBackend;
    vi.spyOn(backend, "getWorkspace").mockRejectedValue(
      new Error("host down"),
    );
    render(
      <DemoProvider store={backend}>
        <Header />
      </DemoProvider>,
    );
    await waitFor(() =>
      expect(screen.getAllByText("Disconnected").length).toBeGreaterThan(0),
    );
    expect(screen.queryByTestId("policy-status")).toBeNull();
  });

  it("renders a custom policy without path allowlist", async () => {
    const policy: PolicyInfo = {
      name: "read-only",
      allowedActions: ["read", "changelist_list", "audit_tail"],
      protectBinaryAssets: true,
      pathAllowlist: null,
      submitAllowed: false,
    };
    const backend = new DemoStore() as P4PilotBackend;
    vi.spyOn(backend, "getPolicy").mockResolvedValue(policy);
    render(
      <DemoProvider store={backend}>
        <Header />
      </DemoProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("policy-name").textContent).toContain(
        "read-only",
      ),
    );
    expect(screen.getByTestId("submit-blocked")).toBeDefined();
    expect(screen.queryByTestId("path-allowlist")).toBeNull();
  });
});

describe("App header policy badge", () => {
  it("shows restricted-agent policy status in the full app shell", async () => {
    render(<App backend={new DemoStore()} />);
    await waitFor(() =>
      expect(screen.getByTestId("policy-status")).toBeDefined(),
    );
    expect(screen.getByTestId("policy-name").textContent).toContain(
      "restricted-agent",
    );
    expect(screen.getByTestId("submit-blocked").textContent).toContain(
      "submit blocked",
    );
  });
});
