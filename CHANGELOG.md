# Changelog

All notable changes to p4pilot are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Agent runtime safety** — process-local `SafetyPolicy` presets (`default`,
  `restricted-agent`, `read-only`) with hard deny of `submit` and optional
  binary-asset open protection (`protectBinaryAssets`).
- Optional `SafetyPolicy.pathAllowlist` and env `P4PILOT_PATH_ALLOWLIST` so
  agents can be limited to depot/workspace path prefixes.
- In-process audit log (`MemoryAuditSink`) and MCP tool `p4_audit_tail`.
- Durable JSONL audit sink (`JsonlFileAuditSink`) via `P4PILOT_AUDIT_LOG`.
- MCP tool `p4_policy_info` — JSON snapshot of the active policy (maps to
  `read`; available under every preset including `read-only`).
- MCP tool `p4_shelve` + `P4Client.shelve` — shelf a pending changelist for
  human review (policy action `shelve`; allowed under default/restricted,
  denied under read-only). Still **no** `p4_submit`.
- HTTP host: policy on mutations, `GET /api/audit`, `GET /api/policy`.
- Web **Audit** panel (Dashboard | Review | Audit) and Header policy badge
  (`submit blocked` + path allowlist summary); demo mode seeds offline data.
- Offline safety bench (`packages/mcp-server/test/bench-safety.test.ts`,
  `docs/BENCH.md`), script `npm run test:bench-safety`, CI job `safety-bench`.
- Env `P4PILOT_POLICY` / `P4PILOT_ACTOR` for agent runtime configuration.
- Security model doc (`docs/SECURITY.md`) and restricted-agent example with
  Helix protect/trigger templates under `examples/restricted-agent/helix/`
  plus `VERIFY.md` checklist.

### Changed

- MCP surface grows from the 0.2.0 baseline to **21 tools** (adds audit tail,
  policy info, shelve); product boundary remains: never expose submit.
- Document Vitest global coverage floors (statements/lines/functions 80%,
  branches 55%) in `CONTRIBUTING.md`; CI Node 22 runs `npm run test:coverage`
  and fails when thresholds are missed.

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
