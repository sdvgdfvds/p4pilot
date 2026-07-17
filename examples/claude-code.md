# Using p4pilot with Claude Code

p4pilot is an MCP server, so Claude Code talks to it over stdio. You can be up
and running in one command.

## 1. Try it with a fake depot (no Perforce needed)

```bash
claude mcp add p4pilot-mock -- npx -y @p4pilot/mcp-server --mock
```

This boots an in-memory game depot (a couple of `.cpp` files, a `.uasset`, an
`.fbx`, and a pending changelist) so you can exercise every tool without a
Perforce server.

## 2. Point it at a real Perforce workspace

p4pilot reuses your existing Perforce connection. If your shell already has
`P4PORT` / `P4CLIENT` / `P4USER` (or a `.p4config`), just add the server:

```bash
claude mcp add p4pilot -- npx -y @p4pilot/mcp-server
```

To pass the connection explicitly, provide the environment variables when adding
the server (e.g. `-e P4PORT=ssl:perforce.example.com:1666 -e P4CLIENT=my-ws
-e P4USER=me`), or rely on your `.p4config`.

> p4pilot never runs `p4 submit` for you. It prepares changelists; a human
> submits. It also never stores credentials — it uses your existing login.

## 3. Run from source (until the npm package is published)

```bash
git clone https://github.com/sdvgdfvds/p4pilot.git
cd p4pilot
npm install && npm run build
# then point Claude Code at the built binary:
claude mcp add p4pilot -- node "$PWD/packages/mcp-server/dist/index.js" --mock
```

## What you'll see

Ask Claude to edit a file and it will check it out first, into the right
changelist, and warn you before touching a binary asset:

```text
$ p4_changelist_create { "description": "player dash tuning" }
Created pending changelist 813: [p4pilot] player dash tuning

$ p4_smart_edit { "paths": ["/depot/game/src/main.cpp", "/depot/game/Content/Hero.uasset"], "changelist": "813" }
Ensured 2 path(s) open for edit:
opened	/depot/game/src/main.cpp [cl 813]
opened	/depot/game/Content/Hero.uasset [cl 813]  ⚠ large-asset — edit carefully (large-asset extension .uasset)
```

See [`../docs/TOOLS.md`](../docs/TOOLS.md) for the full tool reference.
