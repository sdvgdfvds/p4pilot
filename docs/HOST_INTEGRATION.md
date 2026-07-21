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

The UI displays pending changelists, opened files, safe asset metadata, and
review diffs. Smart checkout, revert, and changelist creation use the same core
workflows as MCP. If the process or Perforce connection fails, the header reads
`Disconnected` and the typed error appears in the page.

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
