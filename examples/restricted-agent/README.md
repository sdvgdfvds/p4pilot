# Restricted agent profile (small studios & demos)

How to run p4pilot so an IDE coding agent can prepare Perforce work **without**
getting a product path to submit — and without pretending tool policy alone is
enough.

> Conceptual guide only. Do not put real passwords, tickets, or production
> ports into this repo or into committed config samples.

## What this setup achieves

| Control                           | Role                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| No `p4_submit` tool               | Product boundary: p4pilot never automates submit                                        |
| `P4PILOT_POLICY=restricted-agent` | In-process policy: prepare + review; block delete / sync via MCP (revert still allowed) |
| Restricted Helix user             | Server truth: that user cannot submit (and should be path-limited)                      |
| Human + P4V                       | Real submit happens under a human account after review                                  |

An agent that still has an unrestricted shell **and** credentials for a
full-privilege user can bypass p4pilot. Pair MCP policy with Helix identity.

## 1. Choose the policy preset

Environment variable (read at MCP server startup):

```text
P4PILOT_POLICY=default | restricted-agent | read-only
```

| Value                | Maps to (`@p4pilot/core`) | Typical use                                            |
| -------------------- | ------------------------- | ------------------------------------------------------ |
| `default` (or unset) | `DEFAULT_SAFETY_POLICY`   | Trusted internal agents; submit still hard-denied      |
| `restricted-agent`   | `RESTRICTED_AGENT_POLICY` | Demos, contractors — edit/add/CL ok; no delete/sync    |
| `read-only`          | `READ_ONLY_POLICY`        | Inspection + review tools only (`read` / list / audit) |

Details: [`docs/SPEC.md`](../../docs/SPEC.md) §4.11 and [`docs/SECURITY.md`](../../docs/SECURITY.md).

## 2. Point the agent at p4pilot with the restricted profile

Example (Claude Code-style MCP add — adjust for Cursor / Codex as needed):

```bash
# Mock depot: exercise policy + tools with zero Perforce
claude mcp add p4pilot-restricted-mock -- \
  npx -y @p4pilot/mcp-server --mock

# Real workspace: pass policy + connection via the host environment
# (illustrative names only — use your studio's values)
export P4PILOT_POLICY=restricted-agent
export P4PORT=ssl:perforce.example.invalid:1666
export P4CLIENT=agent-demo-ws
export P4USER=p4pilot-agent   # restricted bot user, not a human submitter
claude mcp add p4pilot-restricted -- npx -y @p4pilot/mcp-server
```

Cursor / Codex: set the same env on the MCP server process (see
[`cursor.mcp.json`](../cursor.mcp.json) and [`codex.config.toml`](../codex.config.toml)
patterns). Do not commit live `P4PASSWD` or tickets.

## 3. Restricted P4 user (Helix side — templates)

Have a Perforce admin create a **bot** user dedicated to agents, for example:

- Username: `p4pilot-agent` (name is arbitrary)
- Group: e.g. `ai-agents`
- **No submit** for that group (protections and/or permissions so `submit` is
  denied server-side)
- Optional: write limited to a sandbox depot path; read broader if review needs it
- Tickets issued only on the agent machine; rotate / expire per studio policy

Exact `p4 protect` / trigger syntax is site-specific — follow your admin
runbook. The important contract is: **even `p4 submit` on the CLI as that user
must fail**.

Human submitters keep separate accounts that _can_ submit after review in P4V.

### Admin templates in this folder

| File | Role |
| ---- | ---- |
| [`helix/protect.sample`](./helix/protect.sample) | Commented protections / permissions patterns (`ai-agents` / `p4pilot-agent`, write without submit) |
| [`helix/triggers.sample`](./helix/triggers.sample) | Optional `change-submit` trigger table sketch (second layer) |
| [`helix/check-submit-deny.sh`](./helix/check-submit-deny.sh) | Sample trigger body (bash) — decision dry-run; install help gated by env |
| [`helix/check-submit-deny.ps1`](./helix/check-submit-deny.ps1) | Same for Windows trigger hosts |
| [`VERIFY.md`](./VERIFY.md) | Real-demo verification checklist + **safe** vs forbidden commands |

Scripts do **not** implement submit automation and will not rewrite production
`p4 protect` / `p4 triggers` tables. Install guidance requires
`P4PILOT_ALLOW_TRIGGER_INSTALL=1` and still only prints steps.

## 4. Recommended demo flow

1. Agent: `p4_changelist_create` → `p4_smart_edit` → edit files → `p4_review`
   or `p4_shelved_review`.
2. Agent (or presenter): `p4_audit_tail` to show recent allowed/denied attempts.
3. Human: open the pending changelist in **P4V**, review, submit under a human
   user.
4. Confirm the agent never received a submit tool and the bot user cannot
   submit even from a terminal.

## 5. What to expect when policy denies

Mutating tools outside the profile return a tool error:

```text
p4pilot error [POLICY_DENIED]: …
```

Example under `restricted-agent`: `p4_delete` / `p4_sync` should deny;
`p4_smart_edit` / `p4_changelist_create` / `p4_review` / `p4_revert` should
allow (when Helix also permits the underlying commands). Under `read-only`,
write tools deny; `p4_status` / `p4_review` / `p4_audit_tail` allow.

## Related docs

- [`VERIFY.md`](./VERIFY.md) — real-demo checklist (policy, bot submit deny, audit)
- [`docs/SECURITY.md`](../../docs/SECURITY.md) — threat model and dual control
- [`docs/TOOLS.md`](../../docs/TOOLS.md) — tool reference including `p4_audit_tail`
- [`docs/SPEC.md`](../../docs/SPEC.md) — `SafetyPolicy`, audit, `ToolContext`
- [`docs/BENCH.md`](../../docs/BENCH.md) — offline safety bench (mock CI)
