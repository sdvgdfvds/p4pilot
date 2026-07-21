# Maya Qt WebEngine Host

`p4pilot_host.py` creates a dockable Maya workspace with Qt WebEngine and loads
the shared local p4pilot page. It supports Maya releases using PySide6 or
PySide2 and reports an explicit error when QtWebEngine is unavailable.

Official reference: [Working with PySide in Maya](https://help.autodesk.com/view/MAYAUL/2026/ENU/?guid=Maya_SDK_MERGED_Working_with_PySide_in_Maya_html)

## Install and start

1. Build and start the local host:

```powershell
npm run build
node packages\mcp-server\dist\http.js --host 127.0.0.1 --port 4715 --web-root packages\web\dist
```

2. Add `hosts/maya` to `MAYA_SCRIPT_PATH`, or copy `p4pilot_host.py` into your
   Maya scripts directory.
3. Run this in Maya's Python console:

```python
import p4pilot_host
p4pilot_host.install_menu()
p4pilot_host.show()
```

Set `P4PILOT_HOST_URL` before launching Maya to change the loopback URL. The
dock shows changelists, opened files, asset metadata, and review from the local
service. A failed page load displays a retryable disconnected state.
