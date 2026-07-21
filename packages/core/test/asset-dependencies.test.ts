import { describe, expect, it } from "vitest";

import {
  resolveAssetDependencies,
  StaticAssetDependencyProvider,
} from "../src/asset-dependencies.js";

const provider = () =>
  new StaticAssetDependencyProvider("fixture", [
    {
      path: "/Game/Hero",
      dependencies: ["/Game/Mesh", "/Game/Anim", "/Game/Missing"],
      referencers: ["/Game/Level"],
    },
    {
      path: "/Game/Mesh",
      dependencies: ["/Game/Material"],
      referencers: ["/Game/Hero"],
    },
    {
      path: "/Game/Anim",
      dependencies: ["/Game/Material"],
      referencers: ["/Game/Hero"],
    },
    {
      path: "/Game/Material",
      dependencies: ["/Game/Hero"],
      referencers: ["/Game/Mesh"],
    },
    {
      path: "/Game/Level",
      dependencies: ["/Game/Hero"],
      referencers: [],
    },
  ]);

describe("resolveAssetDependencies", () => {
  it("returns direct and transitive dependencies, referencers, and missing assets", async () => {
    const report = await resolveAssetDependencies(provider(), "/Game/Hero", {
      direction: "both",
      depth: 2,
    });

    expect(report.provider).toBe("fixture");
    expect(report.directDependencies).toEqual([
      "/Game/Mesh",
      "/Game/Anim",
      "/Game/Missing",
    ]);
    expect(report.directReferencers).toEqual(["/Game/Level"]);
    expect(report.dependencies).toEqual(
      expect.arrayContaining([
        { path: "/Game/Mesh", depth: 1 },
        { path: "/Game/Material", depth: 2 },
      ]),
    );
    expect(report.referencers).toEqual([{ path: "/Game/Level", depth: 1 }]);
    expect(report.missingAssets).toEqual(["/Game/Missing"]);
    expect(report.risks.join(" ")).toContain("missing");
    expect(report.risks.join(" ")).toContain("depth 2");
    expect(report.risks.join(" ")).not.toContain("cycle");
  });

  it("honors a dependencies-only traversal and detects cycles", async () => {
    const report = await resolveAssetDependencies(provider(), "/Game/Hero", {
      direction: "dependencies",
      depth: 3,
    });
    expect(report.directReferencers).toEqual([]);
    expect(report.referencers).toEqual([]);
    expect(report.risks.join(" ")).toContain("cycle");
  });

  it("throws a typed error when the requested asset is absent", async () => {
    await expect(
      resolveAssetDependencies(provider(), "/Game/Unknown"),
    ).rejects.toMatchObject({ code: "ASSET_NOT_FOUND" });
  });
});
