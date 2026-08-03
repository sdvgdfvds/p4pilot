#!/usr/bin/env bash
# p4pilot — sample change-submit deny helper for bot user (documentation / sandbox)
#
# Intended role: Helix change-submit trigger body that rejects submits by the
# restricted agent identity (default: p4pilot-agent).
#
# SAFETY GATES
#   - Does NOT talk to a Perforce server by itself.
#   - Refuses to run in "install guidance" mode without P4PILOT_ALLOW_TRIGGER_INSTALL=1.
#   - Never automates p4 submit. Never deploys to production from this repo.
#
# Usage as a trigger (after admin installs a real copy on the trigger host):
#   check-submit-deny.sh <user> [change] [client]
#
# Usage for local dry-run of the decision logic:
#   ./check-submit-deny.sh p4pilot-agent 12345 demo-client
#   ./check-submit-deny.sh human-dev 12345 demo-client
#
# Optional env:
#   P4PILOT_DENIED_SUBMIT_USERS   comma-separated deny list (default: p4pilot-agent)
#   P4PILOT_ALLOW_TRIGGER_INSTALL=1  required to print install guidance

set -euo pipefail

DENIED_USERS_CSV="${P4PILOT_DENIED_SUBMIT_USERS:-p4pilot-agent}"
USER_ARG="${1:-}"
CHANGE_ARG="${2:-}"
CLIENT_ARG="${3:-}"

usage() {
  cat <<'EOF'
check-submit-deny.sh — sample submit-deny decision for p4pilot bot users

  Decision mode (safe, no network):
    check-submit-deny.sh <user> [change] [client]

  Install guidance only (still no p4 triggers write):
    P4PILOT_ALLOW_TRIGGER_INSTALL=1 check-submit-deny.sh --install-help

Exit codes (decision mode):
  0  allow (user not in deny list)
  1  deny  (user in deny list)  — Helix treats non-zero as trigger failure
  2  usage / configuration error
EOF
}

is_denied_user() {
  local candidate="$1"
  local IFS=','
  local entry
  # shellcheck disable=SC2086
  for entry in ${DENIED_USERS_CSV}; do
    entry="$(echo "${entry}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    if [[ -n "${entry}" && "${candidate}" == "${entry}" ]]; then
      return 0
    fi
  done
  return 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--install-help" ]]; then
  if [[ "${P4PILOT_ALLOW_TRIGGER_INSTALL:-}" != "1" ]]; then
    echo "Refusing install guidance without P4PILOT_ALLOW_TRIGGER_INSTALL=1" >&2
    echo "This prevents accidental production trigger edits from a casual copy-paste." >&2
    exit 2
  fi
  cat <<'EOF'
Install guidance (admin only — adapt paths; sandbox first):

  1. Copy this script to the Helix trigger host (not from a developer laptop ad hoc).
  2. chmod +x the installed copy; ensure the p4d trigger user can execute it.
  3. Add a change-submit line via `p4 triggers` using helix/triggers.sample as a sketch.
  4. Rehearse on a non-production server: submit as p4pilot-agent must fail;
     submit as a human must succeed (for paths they are allowed to submit).
  5. Document the change in your studio change-control system.

This script does not invoke `p4 triggers` or modify any server configuration.
EOF
  exit 0
fi

if [[ -z "${USER_ARG}" ]]; then
  usage >&2
  exit 2
fi

if is_denied_user "${USER_ARG}"; then
  echo "p4pilot submit deny: user '${USER_ARG}' is not permitted to submit (change=${CHANGE_ARG:-n/a} client=${CLIENT_ARG:-n/a})." >&2
  echo "Prepare the changelist with the agent; a human account must submit after review." >&2
  exit 1
fi

exit 0
