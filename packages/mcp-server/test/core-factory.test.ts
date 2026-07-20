import { describe, expect, it } from "vitest";

import { buildCore } from "../src/core-factory.js";

describe("buildCore mock mode", () => {
  it("loads the bundled demo depot", async () => {
    const built = buildCore(["--mock"], {});
    expect(built.mock).toBe(true);
    await expect(built.client.info()).resolves.toMatchObject({
      clientName: "p4pilot-demo",
      userName: "demo",
    });
    const [asset] = await built.client.fstat([
      "/depot/game/Content/Hero.uasset",
    ]);
    expect(asset).toMatchObject({
      headRev: 3,
      headType: "binary+l",
      isTracked: true,
    });
  });

  it("creates independent state for every mock server", async () => {
    const first = buildCore(["--mock"], {});
    await first.client.edit(["/depot/game/src/main.cpp"]);
    expect(await first.client.opened()).toHaveLength(1);

    const second = buildCore(["--mock"], {});
    expect(await second.client.opened()).toHaveLength(0);
  });
});
