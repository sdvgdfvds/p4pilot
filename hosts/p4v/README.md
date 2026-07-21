# P4V HTML Tab

P4V officially supports hosted HTML Tabs and HTML Windows. p4pilot uses an HTML
Tab so the shared React workspace remains docked in P4V's right pane.

Official references:

- [P4V HTML Tabs](https://help.perforce.com/helix-core/server-apps/p4vjs-ug/current/Content/P4VJS-UG/html-tabs.html)
- [P4V custom tools](https://help.perforce.com/helix-core/server-apps/p4v/current/Content/P4V/advanced_options.custom.html)

## One-click local demo

When this repository and the supplied demo are sibling directories named
`p4pilot` and `p4pilot-real-demo`, double-click:

- `start-demo.vbs` to start p4d and `p4pilot-host` invisibly, wait for both to
  become healthy, and open P4V on `p4pilot_interview`.
- `reset-demo.vbs` to delete demo shelves and pending changelists, revert the
  demo client, and force-sync it back to a clean state.

Neither launcher opens PowerShell or exposes `p4 submit`. Failures are written
to `p4pilot-real-demo/logs/p4pilot-demo-launcher.log` and shown as a short dialog.
Run `npm run build` once before using the launchers. In P4V, open the installed
page from **View > HTML Tabs > p4pilot**.

## Build and start

From the repository root:

```powershell
npm install
npm run build
powershell -ExecutionPolicy Bypass -File hosts\p4v\start-p4pilot-host.ps1
```

The script starts a hidden `p4pilot-host` process at
`http://127.0.0.1:4715/p4pilot/?backend=local`. When launched as a P4V custom
tool, it inherits P4V's active `P4PORT`, `P4USER`, and `P4CLIENT`, as documented
by Perforce.

## Install in P4V

1. Open **Tools > Manage Tools > Custom Tools**, add a tool named
   `Start p4pilot`, and set the application to `powershell.exe`.
2. Set arguments to
   `-ExecutionPolicy Bypass -File "D:\path\to\p4pilot\hosts\p4v\start-p4pilot-host.ps1"`.
3. Run **Tools > Start p4pilot** once for the current connection.
4. Open **Tools > Manage Tools > HTML Tabs**, add a tab named `p4pilot`, and set
   its URL to `http://127.0.0.1:4715/p4pilot/?backend=local`.
5. Open the tab from **View > HTML Tabs > p4pilot**.

The tab shows the active client's opened files, pending changelists, safe asset
metadata, and changelist review. If the local host or Perforce connection drops,
the shared UI displays `Disconnected` and the typed backend error.
