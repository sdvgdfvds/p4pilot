# p4pilot — sample change-submit deny helper for bot user (documentation / sandbox)
#
# Intended role: Helix change-submit trigger body that rejects submits by the
# restricted agent identity (default: p4pilot-agent).
#
# SAFETY GATES
#   - Does NOT talk to a Perforce server by itself.
#   - Refuses install guidance without $env:P4PILOT_ALLOW_TRIGGER_INSTALL = "1".
#   - Never automates p4 submit. Never deploys to production from this repo.
#
# Usage as a trigger (after admin installs a real copy on the trigger host):
#   check-submit-deny.ps1 -User <user> [-Change <n>] [-Client <name>]
#
# Decision dry-run:
#   .\check-submit-deny.ps1 -User p4pilot-agent -Change 12345 -Client demo-client
#   .\check-submit-deny.ps1 -User human-dev -Change 12345 -Client demo-client
#
# Optional env:
#   P4PILOT_DENIED_SUBMIT_USERS   comma-separated deny list (default: p4pilot-agent)
#   P4PILOT_ALLOW_TRIGGER_INSTALL=1  required to print install guidance

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string] $User,

    [Parameter(Position = 1)]
    [string] $Change,

    [Parameter(Position = 2)]
    [string] $Client,

    [switch] $InstallHelp,
    [switch] $Help
)

$ErrorActionPreference = "Stop"

function Show-Usage {
    @"
check-submit-deny.ps1 — sample submit-deny decision for p4pilot bot users

  Decision mode (safe, no network):
    .\check-submit-deny.ps1 -User <user> [-Change n] [-Client name]

  Install guidance only (still no p4 triggers write):
    `$env:P4PILOT_ALLOW_TRIGGER_INSTALL = '1'
    .\check-submit-deny.ps1 -InstallHelp

Exit codes (decision mode):
  0  allow (user not in deny list)
  1  deny  (user in deny list)  — Helix treats non-zero as trigger failure
  2  usage / configuration error
"@
}

function Test-DeniedUser {
    param([string] $Candidate)
    $csv = if ($env:P4PILOT_DENIED_SUBMIT_USERS) { $env:P4PILOT_DENIED_SUBMIT_USERS } else { "p4pilot-agent" }
    $entries = $csv.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
    return $entries -contains $Candidate
}

if ($Help) {
    Show-Usage
    exit 0
}

function Write-ErrLine {
    param([string] $Message)
    # Prefer plain stderr so Helix trigger hosts and $LASTEXITCODE stay predictable.
    # (Write-Error + $ErrorActionPreference Stop can skip subsequent exit codes.)
    [Console]::Error.WriteLine($Message)
}

if ($InstallHelp) {
    if ($env:P4PILOT_ALLOW_TRIGGER_INSTALL -ne "1") {
        Write-ErrLine "Refusing install guidance without P4PILOT_ALLOW_TRIGGER_INSTALL=1. This prevents accidental production trigger edits from a casual copy-paste."
        exit 2
    }
    @"
Install guidance (admin only — adapt paths; sandbox first):

  1. Copy this script to the Helix trigger host (not from a developer laptop ad hoc).
  2. Ensure the p4d trigger account can run powershell.exe -File on that path.
  3. Add a change-submit line via ``p4 triggers`` using helix/triggers.sample as a sketch.
  4. Rehearse on a non-production server: submit as p4pilot-agent must fail;
     submit as a human must succeed (for paths they are allowed to submit).
  5. Document the change in your studio change-control system.

This script does not invoke ``p4 triggers`` or modify any server configuration.
"@
    exit 0
}

if ([string]::IsNullOrWhiteSpace($User)) {
    Write-ErrLine (Show-Usage)
    exit 2
}

$changeLabel = if ($Change) { $Change } else { "n/a" }
$clientLabel = if ($Client) { $Client } else { "n/a" }

if (Test-DeniedUser -Candidate $User) {
    Write-ErrLine "p4pilot submit deny: user '$User' is not permitted to submit (change=$changeLabel client=$clientLabel). Prepare the changelist with the agent; a human account must submit after review."
    exit 1
}

exit 0
