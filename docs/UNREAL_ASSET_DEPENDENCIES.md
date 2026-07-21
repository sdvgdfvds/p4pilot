# Unreal Asset Dependency Integration

`p4_asset_dependencies` reads dependency data produced by Unreal's Asset
Registry. It never parses `.uasset` binary files.

## Why Asset Registry

Epic documents the Asset Registry as the editor subsystem that gathers
authoritative information about unloaded assets without loading them. The
official APIs provide on-disk package relationships in both directions:

- [`IAssetRegistry::GetDependencies`](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/AssetRegistry/AssetRegistry/IAssetRegistry/GetDependencies)
- [`IAssetRegistry::GetReferencers`](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/AssetRegistry/AssetRegistry/IAssetRegistry/GetReferencers)
- [Asset Registry overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/asset-registry-in-unreal-engine)

The overview also documents that Asset Registry works in commandlets and scans
synchronously there. A studio plugin, Editor utility, Python script, or custom
commandlet can therefore call both APIs and write the export below after the
registry has completed discovery.

## Export contract

The configured file must be UTF-8 JSON with this versioned shape:

```json
{
  "version": 1,
  "assets": [
    {
      "path": "/Game/Characters/Hero",
      "dependencies": [
        "/Game/Characters/HeroMesh",
        "/Game/Animations/HeroIdle"
      ],
      "referencers": ["/Game/Maps/Arena"]
    },
    {
      "path": "/Game/Characters/HeroMesh",
      "dependencies": ["/Game/Materials/Hero"],
      "referencers": ["/Game/Characters/Hero"]
    }
  ]
}
```

Use Unreal package names, such as `/Game/Characters/Hero`, consistently for
`path`, `dependencies`, and `referencers`. p4pilot deliberately does not infer a
package name from `//depot/.../Hero.uasset`, because mount points and depot
layouts are project-specific.

Every asset that can be traversed should have a record, including leaf assets
with empty arrays. Referenced paths without records are returned as missing
assets rather than silently discarded.

## Configuration

Set the export path in the server environment:

```powershell
$env:P4PILOT_UE_ASSET_REGISTRY_JSON = "D:\exports\asset-registry.json"
npx @p4pilot/mcp-server
```

Or add it to `.p4pilot.json`:

```json
{
  "assetDependencies": {
    "registryJsonPath": "D:/exports/asset-registry.json"
  }
}
```

The environment variable overrides the file setting. The file is loaded lazily
on the first dependency request and validated with zod. Missing files, malformed
JSON, unsupported versions, and invalid records return
`ASSET_DEPENDENCIES_UNAVAILABLE`.

## Query behavior

`direction` controls whether the graph follows dependencies, referencers, or
both. `depth` is limited to 1–10. Results identify direct relationships,
transitive links with their depth, missing records, cycles, and depth cutoffs.

Asset Registry APIs report on-disk relationships. References constructed only
at runtime might not appear, so every report includes that risk explicitly.
`p4_asset_info` remains the safe Perforce metadata view and never returns asset
contents.
