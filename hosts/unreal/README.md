# Unreal Editor Plugin

This editor plugin registers a nomad tab backed by Unreal's official
`SWebBrowser` widget. It loads the same local p4pilot UI used by P4V and Maya.

Official reference: [SWebBrowser API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Plugins/WebBrowserWidget/SWebBrowser)

## Install

1. Copy `hosts/unreal/P4Pilot` into `<Project>/Plugins/P4Pilot`.
2. Enable Unreal's **Web Browser Widget** plugin and the **p4pilot** plugin.
3. Regenerate project files and build the Editor target.
4. Build and start the local host from the p4pilot repository:

```powershell
npm run build
node packages\mcp-server\dist\http.js --host 127.0.0.1 --port 4715 --web-root packages\web\dist
```

5. In Unreal Editor, open **Window > p4pilot**.

Set `P4PILOT_HOST_URL` before launching the editor to use another loopback port.
The tab itself contains no duplicate UI or Perforce logic. Loading failures and
backend disconnects are shown by the shared page.
