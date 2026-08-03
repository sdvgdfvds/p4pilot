# Contributing to p4pilot

Thanks for helping make Perforce safer for coding agents. Read `AGENTS.md` and
`docs/SPEC.md` before changing behavior; they define the repository's execution
rules and public contracts.

## Development setup

Requirements: Node.js 20 or 22 and npm. Perforce is not required.

```bash
npm install
npm run typecheck
npm test
npm run build
```

Useful focused commands:

```bash
npm test -w @p4pilot/core
npm test -w @p4pilot/mcp-server
npm test -w @p4pilot/web
npm run dev -w @p4pilot/web
```

## Change workflow

1. Create a branch from the latest `origin/main`; do not commit directly to
   `main`.
2. Write a failing test for behavior changes and confirm the failure.
3. Implement the smallest complete change, then run the focused test.
4. Update `docs/SPEC.md` in the same commit when an interface or documented
   behavior changes.
5. Run the full quality gate before opening a pull request.

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

### Coverage gate

`npm run test:coverage` is a CI quality gate (Node 22 matrix step in
`.github/workflows/ci.yml`). Root `vitest.config.ts` sets global floors:

| Metric     | Floor |
| ---------- | ----: |
| Statements |   80% |
| Lines      |   80% |
| Functions  |   80% |
| Branches   |   55% |

Vitest exits non-zero when any metric falls below its floor—do not lower these
to green a PR. Prefer adding tests (or small, targeted coverage for trivial
uncovered paths) instead. Offline only: use `MockP4Runner`; never require a
real `p4` binary. For agent-safety invariants see also
`npm run test:bench-safety` and [`docs/BENCH.md`](./docs/BENCH.md).

Use Conventional Commit messages such as `feat:`, `fix:`, `test:`, `docs:`,
`chore:`, or `ci:`.

## Perforce safety

- Tests must use `MockP4Runner`; never require a real `p4` binary or server.
- Do not run stateful commands against a real workspace while developing here.
- Never commit tickets, server addresses, credentials, or `.p4config` files.
- p4pilot intentionally does not automate `p4 submit`; a human reviews and
  submits prepared changelists.

## Pull requests

Keep each pull request focused. Include the problem, behavior change, tests run,
and any documentation updates. UI changes should include a screenshot at desktop
and narrow viewport sizes.
