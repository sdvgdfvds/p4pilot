# Changelog

All notable changes to p4pilot are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
