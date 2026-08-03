# Changelog

All notable changes to p4pilot are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Safety policy profiles (`default`, `restricted-agent`, `read-only`) with hard
  deny of `submit` and optional binary-asset open protection.
- In-process audit log (`MemoryAuditSink`) and MCP tool `p4_audit_tail`.
- Env `P4PILOT_POLICY` / `P4PILOT_ACTOR` for agent runtime safety configuration.
- Security model doc (`docs/SECURITY.md`) and restricted-agent example profile.

## [0.2.0] - 2026-08-03

### Added

- Eighteen MCP tools, including `p4_delete`, `p4_sync`, `p4_reopen`, `p4_where`,
  and `p4_shelved_review`.
- Unreal Asset Registry dependency traversal (`p4_asset_dependencies`) with
  missing-record and traversal-risk reporting.
- Shared live host UI integrations for P4V, Unreal Editor, and Maya.
- Loopback-only `p4pilot-host` HTTP service for the shared Web frontend.
- Click-to-start / reset Windows launchers for the P4V demo under `hosts/p4v`.

### Fixed

- Preserve real shelved changelist unified diffs for server-side review without
  modifying the workspace.
- Bind `HttpBackend` default `fetch` through `globalThis.fetch` so embedded
  WebViews (P4V) no longer throw `Illegal invocation`.

### Changed

- Bump public package versions to `0.2.0` for `@p4pilot/core` and
  `@p4pilot/mcp-server`.

## [0.1.1] - 2026-07-20

### Fixed

- Preserve the requested changelist in real `p4 edit`, `p4 add`, and
  `p4 reopen` results when Helix Core omits it from command output.
- Parse multi-record output from real pending changelists and include their
  workspace unified diff in `p4_describe` and `p4_review`.

## [0.1.0] - 2026-07-20

### Added

- Public package metadata for `@p4pilot/core` and `@p4pilot/mcp-server`.
- Revert, loading, duplicate-operation protection, and visible error states in
  the browser demo.
- Direct tests for MCP edit/add/revert handlers, MCP schema routing, the real
  execa runner boundary, and independent mock server state.
- ESLint, coverage reporting, contribution guidance, ownership, and issue/PR
  templates.

### Changed

- Refreshed the browser demo into a responsive workspace UI with README imagery.
- Consolidated MCP mock data into one bundled source that creates fresh state.
- Extended CI with format, lint, and coverage gates.

- Perforce runner, ztag parser, typed client, auto-checkout, asset guard, and
  changelist helpers in `@p4pilot/core`.
- Twelve Perforce-native MCP tools with zero-setup `--mock` mode.
- React browser demo with workspace and changelist review views.
- Offline Vitest suite, GitHub Actions CI, and GitHub Pages deployment.

[Unreleased]: https://github.com/sdvgdfvds/p4pilot/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/sdvgdfvds/p4pilot/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/sdvgdfvds/p4pilot/releases/tag/v0.1.0
