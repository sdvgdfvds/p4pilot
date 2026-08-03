# Verification checklist — restricted agent + Helix submit deny

Use this for **real-demo** readiness outside pure mock CI. It pairs with
[`README.md`](./README.md) and the Helix templates under [`helix/`](./helix/).

> **No secrets.** Do not record tickets, passwords, or private studio hostnames
> in tickets/PRs. Use placeholders in notes.

## Preconditions

- [ ] Sandbox Helix server or explicitly approved non-production demo server
- [ ] Bot user exists (illustrative name: `p4pilot-agent`)
- [ ] Human reviewer account exists (separate from the bot)
- [ ] Admin has adapted [`helix/protect.sample`](./helix/protect.sample)
- [ ] Optional: submit-deny trigger from [`helix/triggers.sample`](./helix/triggers.sample)

## A. p4pilot policy (agent host)

- [ ] `P4PILOT_POLICY=restricted-agent` (or `read-only` for inspection demos)
- [ ] MCP server process env has no production passwords committed to disk
- [ ] Tool list has **no** `p4_submit` (product boundary)
- [ ] Under `restricted-agent`, mutating tools outside the profile return
      `POLICY_DENIED` (e.g. delete/sync as documented in README)
- [ ] `p4_audit_tail` (or `P4PILOT_AUDIT_LOG`) shows recent allow/deny events

Offline invariant suite (no real server):

```bash
# from repo root — fully offline
npx vitest run packages/mcp-server/test/bench-safety.test.ts
```

See also [`docs/BENCH.md`](../../docs/BENCH.md).

## B. Helix identity (server truth)

- [ ] Agent MCP uses `P4USER=p4pilot-agent` (or your bot name), not a human submitter
- [ ] Bot is path-limited (sandbox depot) per studio protections
- [ ] Bot **cannot** submit (protections and/or trigger)
- [ ] Human account **can** submit after review (P4V or approved path)

## C. Commands that are SAFE to run for verification

These are read-only / informational when used as shown. Prefer them for demos
and runbooks.

```bash
# Connection / identity (safe)
p4 info
p4 -u p4pilot-agent info

# Recent history peek (safe; adjust -m as needed)
p4 changes -m1
p4 -u p4pilot-agent changes -m1

# Protections inspection (safe; requires appropriate rights)
p4 protects -m
p4 -u p4pilot-agent protects -m

# Pending work visibility (safe)
p4 -u p4pilot-agent changes -s pending -m5
p4 -u p4pilot-agent opened
```

Optional decision dry-run for the sample trigger scripts (**no server**, no
submit):

```bash
# Expect exit 1 (deny)
./helix/check-submit-deny.sh p4pilot-agent 0 demo-client

# Expect exit 0 (allow)
./helix/check-submit-deny.sh human-dev 0 demo-client
```

```powershell
# Expect exit 1 (deny)
.\helix\check-submit-deny.ps1 -User p4pilot-agent -Change 0 -Client demo-client
echo $LASTEXITCODE

# Expect exit 0 (allow)
.\helix\check-submit-deny.ps1 -User human-dev -Change 0 -Client demo-client
echo $LASTEXITCODE
```

## D. Explicitly NOT automated / not for casual runbooks

Do **not** document the following as default CI or one-click verify steps:

| Action                                         | Why                                              |
| ---------------------------------------------- | ------------------------------------------------ |
| `p4 submit` against production                 | Destructive / stateful; forbidden from this repo |
| Scripted install of `p4 triggers` to prod      | High blast radius; admin change-control only     |
| Committing tickets / `P4PASSWD` into env files | Secret leakage                                   |
| Using a human super user as the agent identity | Defeats dual control                             |

### Controlled deny test (manual, admin-supervised, sandbox only)

If you need to prove submit deny on a **non-production** server:

1. Create a throwaway sandbox changelist as `p4pilot-agent`.
2. Attempt submit **once** under admin supervision.
3. Confirm the server rejects the submit (protections and/or trigger message).
4. Revert or abandon the throwaway changelist; do not leave junk shelved forever.
5. Confirm a human account can submit an equivalent reviewed change on the sandbox.

This sequence is **manual**. Do not wire it into package scripts or CI.

## E. End-to-end demo pass/fail

| Check                | Pass criteria                                                         |
| -------------------- | --------------------------------------------------------------------- |
| Policy env           | `restricted-agent` (or intended preset) active                        |
| No submit tool       | MCP tool list never includes `p4_submit`                              |
| Bot cannot submit    | Server rejects bot submit on sandbox                                  |
| Human can submit     | Human submits reviewed CL via P4V (sandbox/demo)                      |
| Audit tail works     | `p4_audit_tail` or JSONL shows policy decisions                       |
| Shell-bypass honesty | Team understands dual control ([SECURITY.md](../../docs/SECURITY.md)) |

## Related

- [`README.md`](./README.md) — restricted profile walkthrough
- [`helix/protect.sample`](./helix/protect.sample) — protections templates
- [`helix/triggers.sample`](./helix/triggers.sample) — trigger table sketch
- [`docs/SECURITY.md`](../../docs/SECURITY.md) — dual control & threat model
