import {
  DEFAULT_SAFETY_POLICY,
  READ_ONLY_POLICY,
  RESTRICTED_AGENT_POLICY,
} from "@p4pilot/core";
import { describe, expect, it } from "vitest";

import { buildCore, resolveSafetyPolicy } from "../src/core-factory.js";

describe("buildCore mock mode", () => {
  it("loads the bundled demo depot", async () => {
    const built = buildCore(["--mock"], {});
    expect(built.mock).toBe(true);
    expect(built.policy).toBe(DEFAULT_SAFETY_POLICY);
    expect(built.audit.tail()).toEqual([]);
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

  it("honours P4PILOT_POLICY", () => {
    expect(resolveSafetyPolicy({})).toBe(DEFAULT_SAFETY_POLICY);
    expect(resolveSafetyPolicy({ P4PILOT_POLICY: "restricted-agent" })).toBe(
      RESTRICTED_AGENT_POLICY,
    );
    expect(resolveSafetyPolicy({ P4PILOT_POLICY: "read-only" })).toBe(
      READ_ONLY_POLICY,
    );
    expect(() => resolveSafetyPolicy({ P4PILOT_POLICY: "nope" })).toThrow(
      /unknown P4PILOT_POLICY/,
    );

    const restricted = buildCore(["--mock"], {
      P4PILOT_POLICY: "restricted-agent",
    });
    expect(restricted.policy).toBe(RESTRICTED_AGENT_POLICY);
  });
});
