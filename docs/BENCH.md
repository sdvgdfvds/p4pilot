# Offline safety bench

Small **benchmark-like** unit suite that locks agent safety invariants without a
real Perforce server (`MockP4Runner` + `MemoryAuditSink` only).

## What it covers

File: `packages/mcp-server/test/bench-safety.test.ts`

| Scenario                             | Invariant                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `submit_invariant`                   | `checkPolicy` always denies `submit`; 21 tools include `p4_audit_tail` / `p4_policy_info` / `p4_shelve` and never `p4_submit` |

| `restricted_denies_delete`           | `RESTRICTED_AGENT_POLICY` blocks `p4_delete` with `POLICY_DENIED` and an audit `deny` event                   |
| `restricted_denies_binary_edit`      | Restricted policy blocks `smartEdit` on `.uasset` / binary-large paths + audit deny                           |
| `restricted_allows_text_smart_edit`  | Restricted policy still allows text checkout (not a blanket freeze)                                           |
| `audit_tail_lists`                   | After mixed actions, `p4_audit_tail` returns JSON events reflecting deny/success                              |
| `read_only_blocks_changelist_create` | `READ_ONLY_POLICY` denies `changelist_create`                                                                 |

Handlers are exercised through `withPolicyAndAudit` with a real `ToolContext`
(same gate used by `registerTools`), not live `p4d` scripts.

## How to run

From the repo root (preferred — builds `@p4pilot/core` first via
`pretest:bench-safety`):

```bash
npm run test:bench-safety
```

Equivalent direct Vitest invocation:

```bash
npx vitest run packages/mcp-server/test/bench-safety.test.ts
```

## CI

GitHub Actions job **`safety-bench`** (workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml))
runs `npm run test:bench-safety` on every push/PR. The job name is
`safety bench (offline MockP4Runner)` so studios can spot the offline safety
signal without waiting for the full matrix build. No Perforce server or `p4`
binary is installed in CI.

Separately, the main **build** job’s Node 22 matrix step runs
`npm run test:coverage` against the global floors in root `vitest.config.ts`
(statements/lines/functions 80%, branches 55%). That is a general quality gate,
not a substitute for this safety bench—see [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## What “pass” means for studio trust

A green offline bench means:

1. **No submit surface** — agents cannot obtain a submit tool or a policy allow
   for `submit` through p4pilot’s MCP contract.
2. **Restricted profile is meaningful** — delete and binary asset edits are
   denied and audited; text prep work still works.
3. **Read-only profile is inspection-only** — mutating changelist create is
   blocked.
4. **Audit is observable** — denials and successes show up via `p4_audit_tail`
   for demos and debugging.

It does **not** mean Helix permissions, shell isolation, or a tamper-evident
ledger are in place. Production still needs a restricted P4 user and
server-side submit deny (see `docs/SECURITY.md`).
