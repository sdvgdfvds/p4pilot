// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("App", () => {
  it("renders", () => {
    render(<App />);
    expect(screen.getByTestId("app")).toBeDefined();
  });
});
