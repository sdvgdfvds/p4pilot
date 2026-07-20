# AGENTS.md — Execution contract for p4pilot

This file is the contract for any AI agent (Codex, Claude Code, etc.) working in
this repository. Read it fully before writing code. The authoritative design is
in `docs/SPEC.md`; the task-by-task work order is in `docs/PLAN.md`.

## What p4pilot is

p4pilot is the **Perforce-native layer for AI coding agents**. Mainstream coding
agents (Claude Code, Cursor, Codex, Copilot) assume Git. Game studios run on
**Perforce (P4)**. p4pilot closes that gap: it ships an **MCP server** plus a
**core library** that give any MCP-compatible agent safe, first-class Perforce
behavior — auto-checkout before edits, changelist-aware planning, binary-asset
guarding, and changelist code review.

## Golden rules (do not break these)

1. **TDD, always.** Write the failing test first, watch it fail, implement the
   minimum to pass, watch it pass, then commit. Follow `docs/PLAN.md` step order.
2. **Tests must pass fully offline.** There is NO real Perforce server in CI.
   All `@p4pilot/core` logic is tested against `MockP4Runner` (an in-memory fake
   depot). Never write a test that shells out to a real `p4` binary or network.
3. **Never run destructive/stateful Perforce commands** against a real server
   from this repo (`p4 submit`, `p4 delete`, `p4 revert` on real data, etc.).
   Real-runner code paths are exercised only through mocked unit tests.
4. **No placeholders.** No `TODO`, no stubbed function bodies left unimplemented,
   no "handle errors appropriately". Every function you touch is complete and
   tested.
5. **Small, frequent commits.** One task = one (or a few) focused commits with a
   conventional-commit message (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
6. **Strict TypeScript, ESM only.** `"type": "module"`, `NodeNext` resolution.
   No `any` unless justified with a comment. Respect `noUncheckedIndexedAccess`.
7. **Follow the interfaces in `docs/SPEC.md` exactly** — function names,
   parameter names, and return types are contracts other packages depend on.
   If you must change one, update the SPEC in the same commit.

## Repo layout

```
p4pilot/
├── package.json            # npm workspaces root
├── tsconfig.base.json      # shared TS config (packages extend this)
├── AGENTS.md               # you are here
├── README.md               # public-facing pitch (keep accurate to features shipped)
├── docs/
│   ├── SPEC.md             # authoritative technical design + interfaces
│   └── PLAN.md             # task-by-task TDD work order (do these in order)
├── examples/               # runnable demos + agent config snippets
└── packages/
    ├── core/               # @p4pilot/core — runner, parser, client, workflows
    └── mcp-server/         # @p4pilot/mcp-server — MCP tools over core
```

## Commands

Run from the repo root:

- Install: `npm install`
- Test (all): `npm test` (alias for `vitest run`)
- Test one file: `npx vitest run packages/core/test/ztag.test.ts`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Format: `npm run format`

**Definition of done for every task:** the new test passes, `npm run typecheck`
is clean, `npm test` is green, and the work is committed.

## Conventions

- **Package manager:** npm workspaces (pnpm is NOT installed). If a dependency
  version in a `package.json` fails to resolve, pick the nearest published
  version, install, and commit the updated `package-lock.json`.
- **Test runner:** Vitest. Tests live in each package's `test/` dir as `*.test.ts`.
- **Schemas:** MCP tool inputs are validated with `zod`.
- **Process spawning:** use `execa` for the real `p4` runner.
- **Naming:** camelCase for functions/vars, PascalCase for types/classes,
  kebab-case for file names.
- **Errors:** throw typed `P4PilotError` (defined in core) with a machine code;
  never swallow errors silently.

## What NOT to do

- Do not add a real Perforce integration test to CI.
- Do not introduce a second package manager or a bundler other than `tsup`.
- Do not broaden scope beyond the current task in `docs/PLAN.md`. If you spot
  follow-up work, note it at the bottom of `docs/PLAN.md` under "Discovered
  follow-ups" instead of implementing it.
- Do not put real Perforce credentials, tickets, or server addresses anywhere.

## Fill-me-in

- `LICENSE` copyright line and `package.json` `author` fields currently say
  "p4pilot contributors" — leave as-is unless the maintainer provides a name.
