import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

import {
  buildChangelistDescription,
  classifyAsset,
  ensureOpenForEdit,
  P4PilotError,
  type P4Client,
  type P4PilotConfig,
} from "@p4pilot/core";
import { z } from "zod";

export interface HostServiceOptions {
  client: P4Client;
  config: P4PilotConfig;
  webRoot: string;
  mode: "mock" | "live";
}

const pathBody = z.object({ path: z.string().min(1) });
const smartEditBody = pathBody.extend({
  changelist: z.string().min(1).optional(),
});
const changelistBody = z.object({ description: z.string().min(1) });

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) {
      throw new P4PilotError("request body exceeds 1 MB", "INVALID_INPUT");
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new P4PilotError("request body must be valid JSON", "INVALID_INPUT");
  }
}

function errorStatus(code: string): number {
  if (code === "INVALID_INPUT") return 400;
  if (code === "ASSET_NOT_FOUND" || code === "FILE_NOT_IN_CLIENT") return 404;
  if (code === "NOT_CONNECTED") return 503;
  return 502;
}

async function assetInfo(client: P4Client, path: string) {
  const [stat] = await client.fstat([path]);
  if (stat === undefined) {
    throw new P4PilotError(
      `asset ${path} was not found in the client`,
      "ASSET_NOT_FOUND",
    );
  }
  const asset = classifyAsset(path, { stat });
  return {
    path,
    kind: asset.kind,
    filetype: asset.filetype,
    tracked: stat.isTracked,
    headRev: stat.headRev,
    shouldRead: asset.shouldRead,
    reason: asset.reason,
  };
}

async function workspace(client: P4Client, mode: "mock" | "live") {
  const [info, opened, changelists] = await Promise.all([
    client.info(),
    client.opened(),
    client.changes({ status: "pending", max: 100 }),
  ]);
  const stats =
    opened.length === 0
      ? []
      : await client.fstat(opened.map((file) => file.depotFile));
  const files = opened.map((file) => {
    const stat = stats.find((item) => item.depotFile === file.depotFile);
    const asset = classifyAsset(file.clientFile ?? file.depotFile, { stat });
    return {
      depotFile: file.depotFile,
      clientFile: file.clientFile ?? file.depotFile,
      kind: asset.kind,
      shouldRead: asset.shouldRead,
      opened: true,
      action: file.action,
      change: file.change,
      headRev: stat?.headRev ?? file.rev,
    };
  });
  return {
    connection: {
      mode,
      workspace: info.clientName ?? "unknown",
      user: info.userName,
      root: info.clientRoot,
    },
    files,
    changelists,
  };
}

async function serveStatic(
  response: ServerResponse,
  pathname: string,
  webRoot: string,
): Promise<void> {
  const relative = pathname.replace(/^\/p4pilot\/?/, "").replace(/^\/+/, "");
  const requested = relative.length === 0 ? "index.html" : relative;
  const root = resolve(webRoot);
  const target = resolve(root, requested);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    sendJson(response, 403, {
      error: { code: "INVALID_INPUT", message: "invalid path" },
    });
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, {
      "content-type":
        contentTypes[extname(target)] ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    try {
      const body = await readFile(resolve(root, "index.html"));
      response.writeHead(200, { "content-type": contentTypes[".html"] });
      response.end(body);
    } catch {
      sendJson(response, 404, {
        error: {
          code: "UI_NOT_BUILT",
          message: `web build not found at ${root}`,
        },
      });
    }
  }
}

export function createHostServer(options: HostServiceOptions) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, { ok: true, server: "p4pilot" });
      } else if (
        request.method === "GET" &&
        url.pathname === "/api/workspace"
      ) {
        sendJson(response, 200, await workspace(options.client, options.mode));
      } else if (
        request.method === "GET" &&
        url.pathname === "/api/asset-info"
      ) {
        const path = z.string().min(1).parse(url.searchParams.get("path"));
        sendJson(response, 200, await assetInfo(options.client, path));
      } else if (request.method === "GET" && url.pathname === "/api/review") {
        const change = z.string().min(1).parse(url.searchParams.get("change"));
        sendJson(
          response,
          200,
          await options.client.describe(change, { diff: true }),
        );
      } else if (
        request.method === "POST" &&
        url.pathname === "/api/smart-edit"
      ) {
        const body = smartEditBody.parse(await readJson(request));
        sendJson(
          response,
          200,
          await ensureOpenForEdit(
            options.client,
            body.path,
            body.changelist ? { changelist: body.changelist } : undefined,
          ),
        );
      } else if (request.method === "POST" && url.pathname === "/api/revert") {
        const body = pathBody.parse(await readJson(request));
        sendJson(response, 200, {
          reverted: await options.client.revert([body.path]),
        });
      } else if (
        request.method === "POST" &&
        url.pathname === "/api/changelists"
      ) {
        const body = changelistBody.parse(await readJson(request));
        const description = buildChangelistDescription(
          body.description,
          options.config.defaultChangelistPrefix,
        );
        sendJson(response, 200, {
          change: await options.client.newChangelist(description),
        });
      } else if (url.pathname.startsWith("/api/")) {
        sendJson(response, 404, {
          error: { code: "NOT_FOUND", message: "API route not found" },
        });
      } else {
        await serveStatic(response, url.pathname, options.webRoot);
      }
    } catch (error) {
      if (error instanceof P4PilotError) {
        sendJson(response, errorStatus(error.code), {
          error: {
            code: error.code,
            message: error.message,
            detail: error.detail,
          },
        });
      } else if (error instanceof z.ZodError) {
        sendJson(response, 400, {
          error: { code: "INVALID_INPUT", message: z.prettifyError(error) },
        });
      } else {
        sendJson(response, 500, {
          error: {
            code: "INTERNAL",
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  });
}
