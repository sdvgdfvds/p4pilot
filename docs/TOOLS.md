# p4pilot MCP Tool Reference

> p4pilot intentionally has no `p4_submit` tool. It prepares and reviews pending
> changelists; a human submits them through the normal Perforce workflow.

`@p4pilot/mcp-server` exposes **16 MCP tools** over stdio. Every tool input is
validated with [zod](https://zod.dev); every tool returns plain-text content.
Errors come back as tool errors of the form `p4pilot error [CODE]: message`
(see [Error codes](#error-codes)).

All examples below are **real output**, captured by driving the shipped server
binary in mock mode:

```bash
npx @p4pilot/mcp-server --mock   # in-memory game depot, no Perforce required
```

The fake depot contains `src/main.cpp` & `src/player.cpp` (text),
`Content/Hero.uasset` & `Art/hero_mesh.fbx` (binary), and one pending changelist
`812`.

---

## `p4_status`

List the files currently open in the workspace.

**Input:** _(none)_

```text
$ p4_status {}
No files are currently open.
```

After a couple of files are checked out (see `p4_smart_edit`):

```text
$ p4_status {}
2 open file(s):
edit	//depot/game/src/main.cpp (change 813)
edit	//depot/game/Content/Hero.uasset (change 813)
```

---

## `p4_smart_edit` — the headline tool

Ensure each path is open for edit (or `add`, if the file is new) **before** the
agent modifies it — attaching it to the given changelist and flagging
binary/large assets so the agent edits them deliberately.

**Input:** `{ paths: string[] (≥1), changelist?: string }`

```text
$ p4_smart_edit { "paths": ["/depot/game/src/main.cpp", "/depot/game/Content/Hero.uasset"], "changelist": "813" }
Ensured 2 path(s) open for edit:
opened	/depot/game/src/main.cpp [cl 813]
opened	/depot/game/Content/Hero.uasset [cl 813]  ⚠ large-asset — edit carefully (large-asset extension .uasset)
```

Per-file status is one of `already-open`, `opened`, or `added`.

---

## `p4_edit`

Open existing depot files for edit. (Thin wrapper over `p4 edit` — use
`p4_smart_edit` when you want the add/asset-aware behavior.)

**Input:** `{ paths: string[] (≥1), changelist?: string }`

```text
$ p4_edit { "paths": ["/depot/game/src/player.cpp"] }
p4 edit: //depot/game/src/player.cpp
```

---

## `p4_add`

Open new files for `add`.

**Input:** `{ paths: string[] (≥1), changelist?: string }`

```text
$ p4_add { "paths": ["/depot/game/src/enemy.cpp"] }
p4 add: //depot/game/src/enemy.cpp
```

---

## `p4_revert`

Revert opened files, discarding pending changes.

**Input:** `{ paths: string[] (≥1) }`

```text
$ p4_revert { "paths": ["/depot/game/src/player.cpp"] }
Reverted: //depot/game/src/player.cpp
```

---

## `p4_delete`

Open tracked files for delete, optionally in a numbered pending changelist.
This prepares a delete for human review; it does not submit the changelist.

**Input:** `{ paths: string[] (>=1), changelist?: string }`

```text
$ p4_delete { "paths": ["/depot/game/src/obsolete.cpp"], "changelist": "813" }
p4 delete: //depot/game/src/obsolete.cpp
```

---

## `p4_sync`

Sync the whole workspace, or only the supplied paths, to the latest revision.

**Input:** `{ paths?: string[] (>=1) }`

```text
$ p4_sync { "paths": ["/depot/game/src/player.cpp"] }
Synced 1 file(s).
```

Pass `{}` to sync the whole workspace.

---

## `p4_reopen`

Move files that are already open into a numbered pending changelist without
changing their actions.

**Input:** `{ paths: string[] (>=1), changelist: string }`

```text
$ p4_reopen { "paths": ["/depot/game/src/player.cpp"], "changelist": "813" }
Reopened in changelist 813: //depot/game/src/player.cpp
```

---

## `p4_where`

Show how one file maps between depot, client, and local filesystem paths.

**Input:** `{ path: string }`

```text
$ p4_where { "path": "/depot/game/src/player.cpp" }
depotFile: //depot/game/src/player.cpp
clientFile: //p4pilot-demo/src/player.cpp
path: /depot/game/src/player.cpp
```

---

## `p4_changelist_create`

Create a pending changelist. The description is prefixed with the configured
`defaultChangelistPrefix` (default `[p4pilot] `).

**Input:** `{ description: string (≥1) }`

```text
$ p4_changelist_create { "description": "player dash tuning" }
Created pending changelist 813: [p4pilot] player dash tuning
```

---

## `p4_changelist_list`

List pending or submitted changelists.

**Input:** `{ status?: "pending" | "submitted", max?: number }`

```text
$ p4_changelist_list { "status": "pending" }
812	pending	wip: player dash ability
813	pending	[p4pilot] player dash tuning
```

---

## `p4_describe`

Show a changelist's metadata and files, optionally with a diff.

**Input:** `{ change: string, diff?: boolean }`

```text
$ p4_describe { "change": "812", "diff": true }
Change 812 by demo
wip: player dash ability
Files:
  edit	//depot/game/src/player.cpp
```

> In `--mock` mode the fake depot has no file contents, so the diff is empty.
> Against a real server, `diff: true` embeds the unified diff from
> `p4 describe -du`.

---

## `p4_review`

Turn a changelist into a review-ready summary — "PR review" for Perforce.
Always fetches the diff.

**Input:** `{ change: string }`

```text
$ p4_review { "change": "812" }
Review of change 812 — 1 file(s), by demo
wip: player dash ability

Files:
  edit	//depot/game/src/player.cpp

Diff:
(no diff available)
```

Against a real server the `Diff:` section contains the full unified diff, e.g.:

```text
Diff:
==== //depot/game/src/player.cpp#7 (text) ====
@@ -40,6 +40,9 @@
   void Player::Update(float dt) {
+    if (input.Pressed(Dash)) {
+      StartDash();
+    }
```

_(illustrative — requires a real Perforce connection)_

---

## `p4_asset_info`

Classify a file. For binary/large assets it returns **metadata only** and
withholds the bytes, so binary blobs never flood the agent's context window.

**Input:** `{ path: string }`

```text
$ p4_asset_info { "path": "/depot/game/Content/Hero.uasset" }
path: /depot/game/Content/Hero.uasset
kind: large-asset
filetype: binary+l
tracked: true
headRev: 3
shouldRead: false
reason: large-asset extension .uasset

(binary / large asset — content withheld; act on the metadata above, do not read bytes)
```

For a text file, `shouldRead` is `true`:

```text
$ p4_asset_info { "path": "/depot/game/src/main.cpp" }
path: /depot/game/src/main.cpp
kind: text
filetype: text
tracked: true
headRev: 4
shouldRead: true
reason: text extension .cpp
```

---

## `p4_filelog`

Show a file's revision history.

**Input:** `{ path: string, max?: number }`

```text
$ p4_filelog { "path": "/depot/game/src/player.cpp" }
#7 change 1 add by demo: initial revision
```

---

## `p4_search`

Text-search the synced workspace, **skipping binary assets** via the asset
guard. Requires a real synced workspace (the `--mock` depot has no files on
disk), so the example below is illustrative:

**Input:** `{ query: string (≥1), glob?: string }`

```text
$ p4_search { "query": "Dash" }
1 match(es) for "Dash":
/depot/game/src/player.cpp:42:   void Player::Dash() {
```

A matching `.uasset` with the word in its name is never returned — only readable
text files are searched.

---

## Error codes

Tool errors are formatted as `p4pilot error [CODE]: message`. Codes:

| Code                 | Meaning                                                |
| -------------------- | ------------------------------------------------------ |
| `P4_NOT_FOUND`       | the `p4` binary is not installed / not on `PATH`       |
| `P4_COMMAND_FAILED`  | `p4` returned a non-zero exit (message carries stderr) |
| `NOT_CONNECTED`      | no `P4PORT` / not logged in                            |
| `FILE_NOT_IN_CLIENT` | path is not mapped into the workspace                  |
| `INVALID_INPUT`      | the arguments failed validation                        |

Example:

```text
$ p4_describe { "change": "999999" }
p4pilot error [P4_COMMAND_FAILED]: describe failed — change 999999 unknown
```
