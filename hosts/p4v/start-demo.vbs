Option Explicit

Dim fso, shell, scriptDir, hostsDir, repoRoot, demoRoot, entry, logPath
Dim command, exitCode

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
hostsDir = fso.GetParentFolderName(scriptDir)
repoRoot = fso.GetParentFolderName(hostsDir)
demoRoot = fso.BuildPath(fso.GetParentFolderName(repoRoot), "p4pilot-real-demo")
entry = fso.BuildPath(repoRoot, "packages\mcp-server\dist\demo.js")
logPath = fso.BuildPath(demoRoot, "logs\p4pilot-demo-launcher.log")

If Not fso.FileExists(entry) Then
  MsgBox "p4pilot demo is not built. Run the repository build first.", vbCritical, "p4pilot"
  WScript.Quit 1
End If

command = Quote("node") & " " & Quote(entry) & " start --repo-root " & _
  Quote(repoRoot) & " --demo-root " & Quote(demoRoot)
exitCode = shell.Run(command, 0, True)

If exitCode <> 0 Then
  MsgBox "p4pilot could not start. See " & logPath, vbCritical, "p4pilot"
End If

Function Quote(value)
  Quote = Chr(34) & value & Chr(34)
End Function
