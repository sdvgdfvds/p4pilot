# p4pilot Security Model

Short reference for how p4pilot limits agent damage, what it does **not**
guarantee, and how small studios should embed it safely.

## Product boundary: no submit tool

p4pilot **never** exposes a `p4_submit` MCP tool (or host HTTP submit route).
The product prepares pending and shelved changelists; a human reviews and
submits through the normal Perforce workflow (typically P4V or an equivalent
approved path).

**Shelve is allowed for agents as prep, not submit.** The MCP tool `p4_shelve`
(policy action `shelve`) stores a pending changelist on the server for human
review. It is permitted under `default` and `restricted-agent` presets and
denied under `read-only`. Shelve does not promote or submit the changelist.

This boundary is intentional and stable. Do not add submit automation to the
public MCP surface.

## Dual control

Agent safety needs **two** independent layers:

| Layer                                            | What it is                                                                                                                                                        | What it stops                                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Tool policy** (`@p4pilot/core` `SafetyPolicy`) | In-process allow/deny on MCP tool actions (`submit` always denied; presets via `P4PILOT_POLICY`; optional sandbox via `pathAllowlist` / `P4PILOT_PATH_ALLOWLIST`) | Misbehaving or over-eager agents calling p4pilot tools (e.g. delete/sync under `restricted-agent`, or edits outside a sandbox prefix) |
| **Helix protections**                            | Restricted P4 user, group permissions, server-side **submit deny** (protections / triggers / permissions as your admin standard requires)                         | Any client that still holds tickets — including shell `p4 submit` outside p4pilot                                                     |

**Both** are required in production. Tool policy alone is not a security
boundary against a full-privilege agent host.

## Audit purpose

`AuditSink` records recent policy decisions and tool attempts for demos,
debugging, and light accountability:

| Sink                  | When                                            |
| --------------------- | ----------------------------------------------- |
| `MemoryAuditSink`     | Default (in-process ring buffer)                |
| `JsonlFileAuditSink`  | When `P4PILOT_AUDIT_LOG=/path/to/file.jsonl`    |
| MCP `p4_audit_tail`   | Agent-readable tail of the process sink         |
| MCP `p4_policy_info`  | Active `SafetyPolicy` snapshot (maps to `read`) |
| HTTP `GET /api/audit` | Host UI / local tooling (loopback only)         |

Audit is **not**:

- a substitute for Helix journal or server audit logs
- a cryptographic or tamper-evident ledger
- proof that the agent did not act outside p4pilot

## Threat model honesty (shell bypass)

If an agent runtime has:

1. an unrestricted **shell** (or any way to exec `p4`), and
2. **valid Perforce credentials** (ticket / password / trust) for a user that
   can submit,

then that agent can bypass p4pilot entirely and run `p4 submit`, `p4 delete`,
etc. on the CLI. p4pilot cannot prevent that from inside the MCP process.

Mitigations that actually work:

- Run the agent under a **restricted P4 user** that cannot submit (and ideally
  cannot open files outside allowed paths).
- Enforce **server-side submit deny** for that user/group.
- Prefer agent hosts that do **not** grant a general-purpose shell when only
  MCP tools are needed.
- Use `P4PILOT_POLICY=restricted-agent` or `read-only` so even the MCP surface
  is narrowed for demos and less-trusted sessions.
- Optionally set `P4PILOT_PATH_ALLOWLIST` (comma/semicolon-separated depot or
  client path prefixes) so mutating tools cannot touch paths outside a studio
  sandbox — complementary to Helix path protections, not a substitute.

## Recommended studio embed

**IDE agent + P4V human submit** is the recommended small-studio shape:

1. Coding agent talks to `p4pilot-mcp` over MCP (auto-checkout, changelists,
   review tools).
2. Policy preset: `restricted-agent` for demos / junior agents; `default` for
   trusted internal agents that still must not submit via tools. Optionally
   set `P4PILOT_PATH_ALLOWLIST` to the agent sandbox depot prefixes.
3. P4 identity: dedicated service or bot user with **no submit** permission.
4. Human opens P4V (or studio-approved UI), reviews the pending changelist, and
   submits with a **human** account that _does_ have submit rights.
5. Optional: `p4_audit_tail` / `P4PILOT_AUDIT_LOG` during demos to show what the
   agent attempted; `p4_policy_info` to confirm the active preset and allowlist.
6. Offline safety invariants: see [`docs/BENCH.md`](./BENCH.md).

See also [`examples/restricted-agent/README.md`](../examples/restricted-agent/README.md)
for a conceptual setup walkthrough (no real secrets), plus Helix admin templates:

- [`examples/restricted-agent/helix/protect.sample`](../examples/restricted-agent/helix/protect.sample) —
  commented protections / permissions patterns for a bot user that can write but
  must not submit
- [`examples/restricted-agent/helix/triggers.sample`](../examples/restricted-agent/helix/triggers.sample)
  and `check-submit-deny.*` — optional change-submit deny layer (templates /
  dry-run only)
- [`examples/restricted-agent/VERIFY.md`](../examples/restricted-agent/VERIFY.md) —
  real-demo verification checklist (safe commands only; no automated production submit)
