# Host Integration

P4V, Unreal Editor, and Maya all load one shared URL:

```text
http://127.0.0.1:4715/p4pilot/?backend=local
```

`p4pilot-host` serves the built React app and a same-origin JSON API backed by
the real `P4Client`. It binds only to `127.0.0.1`, `::1`, or `localhost` and has
no submit endpoint.

## Start the service

```powershell
npm install
npm run build
node packages\mcp-server\dist\http.js --host 127.0.0.1 --port 4715 --web-root packages\web\dist
```

The process uses `P4PORT`, `P4USER`, and `P4CLIENT` from its environment. Add
`--mock` for an offline host demonstration. Health is available at
`http://127.0.0.1:4715/api/health`.

The UI has three tabs: **Dashboard** (pending changelists, opened files, safe
asset metadata, smart checkout/revert), **Review** (changelist diffs), and
**Audit** (recent policy/tool decisions via `GET /api/audit`). The header shows
the active safety policy (name badge, submit blocked, optional path allowlist)
from `GET /api/policy`. Smart checkout, revert, and changelist creation use the
same core workflows as MCP. If the process or Perforce connection fails, the
header reads `Disconnected` and the typed error appears in the page.

### Policy API

```http
GET /api/policy
```

Returns the host's active `SafetyPolicy` as JSON:

```json
{
  "name": "restricted-agent",
  "allowedActions": ["read", "edit", "add", "revert", "reopen", "changelist_create", "changelist_list", "audit_tail"],
  "protectBinaryAssets": true,
  "pathAllowlist": ["//depot/game/src"],
  "submitAllowed": false
}
```

`pathAllowlist` is `null` when no path restriction is configured.
`submitAllowed` is always `false` (human submit boundary). Read-only — there is
no write route for policy. Demo mode returns a fixed restricted-agent sample.

### Audit API

```http
GET /api/audit?limit=50
```

Returns `{ "events": AuditEvent[] }` (newest last). Each event includes
`timestamp`, `decision` (`deny` | `success` | `error`), `tool`, `action`, and
optional `message` / `paths` / `changelist`. The web Audit tab loads this
endpoint (demo mode seeds sample allow/deny events without a host).

## P4V

Use the official P4V HTML Tab integration and startup script in
[`hosts/p4v`](../hosts/p4v/README.md). A P4V Custom Tool starts the service with
the active connection environment, then the HTML Tab docks the shared URL.
For the supplied Windows demo, `start-demo.vbs` and `reset-demo.vbs` provide
double-click startup and cleanup without a terminal window. Their tested Node
orchestrator starts only the dedicated local p4d/client and never submits.

## Unreal Editor

Install the editor plugin in [`hosts/unreal`](../hosts/unreal/README.md). It uses
Unreal's `SWebBrowser` and registers **Window > p4pilot**.

## Maya

Install the dockable PySide host in [`hosts/maya`](../hosts/maya/README.md). It
supports PySide6 and PySide2 Qt WebEngine and includes a retryable load error.
