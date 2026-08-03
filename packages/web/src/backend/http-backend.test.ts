import { describe, expect, it, vi } from "vitest";

import { HttpBackend } from "./http-backend.js";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("HttpBackend", () => {
  it("preserves the global receiver required by embedded webview fetch", async () => {
    const windowFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve(
        json({
          connection: {
            mode: "live",
            workspace: "embedded-ws",
            user: "alice",
            root: "D:/ws",
          },
          files: [],
          changelists: [],
        }),
      );
    });
    vi.stubGlobal("fetch", windowFetch);

    try {
      const backend = new HttpBackend("http://127.0.0.1:4715");
      await expect(backend.getWorkspace()).resolves.toMatchObject({
        connection: { workspace: "embedded-ws" },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("loads workspace and converts unified review diffs for the shared UI", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/workspace")) {
        return json({
          connection: {
            mode: "live",
            workspace: "real-ws",
            user: "alice",
            root: "D:/ws",
          },
          files: [],
          changelists: [],
        });
      }
      if (url.includes("/api/review?")) {
        return json({
          change: "42",
          description: "real review",
          user: "alice",
          files: [{ depotFile: "//depot/a.c", action: "edit", rev: 2 }],
          diff: "--- //depot/a.c#2\n+++ //depot/a.c@=42\n@@ -1 +1 @@\n-old\n+new",
        });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    const backend = new HttpBackend("http://127.0.0.1:4715", fetcher);

    await expect(backend.getWorkspace()).resolves.toMatchObject({
      connection: { mode: "live", workspace: "real-ws" },
    });
    const review = await backend.review("42");
    expect(review.files[0]!.rows).toEqual([
      { type: "del", text: "old" },
      { type: "add", text: "new" },
    ]);
  });

  it("surfaces backend disconnect errors", async () => {
    const backend = new HttpBackend(
      "http://127.0.0.1:4715",
      vi.fn(async () =>
        json(
          { error: { code: "P4_COMMAND_FAILED", message: "not connected" } },
          503,
        ),
      ),
    );
    await expect(backend.getWorkspace()).rejects.toThrow(
      "P4_COMMAND_FAILED: not connected",
    );
  });

  it("fetches audit events from GET /api/audit", async () => {
    const events = [
      {
        id: "a1",
        timestamp: "2026-07-30T14:02:11.000Z",
        tool: "host.smart-edit",
        action: "edit",
        decision: "success",
        paths: ["/ws/player.cpp"],
      },
      {
        id: "a2",
        timestamp: "2026-07-30T14:03:04.000Z",
        tool: "host.smart-edit",
        action: "delete",
        decision: "deny",
        message: 'action "delete" denied by policy "restricted-agent"',
      },
    ];
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "http://127.0.0.1:4715/api/audit?limit=25") {
        return json({ events });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    const backend = new HttpBackend("http://127.0.0.1:4715", fetcher);

    await expect(backend.listAuditEvents(25)).resolves.toEqual(events);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("omits limit query when listAuditEvents is called without a limit", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "http://127.0.0.1:4715/api/audit") {
        return json({ events: [] });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    const backend = new HttpBackend("http://127.0.0.1:4715", fetcher);
    await expect(backend.listAuditEvents()).resolves.toEqual([]);
  });
});
