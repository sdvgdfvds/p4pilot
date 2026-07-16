import { describe, expect, it } from "vitest";

import { classifyAsset } from "../src/asset-guard.js";
import type { FileStat } from "../src/types.js";

describe("classifyAsset", () => {
  it("flags .uasset as large-asset, shouldRead=false", () => {
    const classification = classifyAsset("/ws/Content/Hero.uasset");
    expect(classification.kind).toBe("large-asset");
    expect(classification.shouldRead).toBe(false);
  });

  it("flags a text .cpp as text, shouldRead=true", () => {
    expect(classifyAsset("/ws/src/hero.cpp").shouldRead).toBe(true);
  });

  it("uses the p4 filetype: binary+l => binary", () => {
    const stat: FileStat = {
      depotFile: "//depot/x.dat",
      isOpened: false,
      isTracked: true,
      headType: "binary+l",
    };
    expect(classifyAsset("/ws/x.dat", { stat }).kind).toBe("binary");
  });

  it("treats oversized text as binary", () => {
    expect(classifyAsset("/ws/big.json", { sizeBytes: 5_000_000 }).kind).toBe("binary");
  });

  it("shouldRead is false for binary and large-asset files", () => {
    expect(classifyAsset("/ws/tex.png").shouldRead).toBe(false);
    expect(classifyAsset("/ws/mesh.fbx").shouldRead).toBe(false);
  });

  it("respects a custom config", () => {
    const classification = classifyAsset("/ws/weird.xyz", {
      config: { binaryExtensions: [".xyz"] },
    });
    expect(classification.kind).toBe("binary");
  });
});
