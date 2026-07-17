import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildChangelistDescription,
  classifyAsset,
  ensureOpenForEditMany,
  P4PilotError,
  type P4Client,
  type P4PilotConfig,
} from "@p4pilot/core";
import { z } from "zod";

export interface SearchHit {
  file: string;
  line: number;
  text: string;
}

export type Searcher = (query: string, opts?: { glob?: string }) => Promise<SearchHit[]>;

export interface ToolContext {
  client: P4Client;
  config: P4PilotConfig;
  search: Searcher;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  // The MCP SDK's CallToolResult carries an index signature; mirror it so this
  // handler return type is assignable to what registerTool expects.
  [key: string]: unknown;
}

function ok(textValue: string): ToolResult {
  return { content: [{ type: "text", text: textValue }] };
}

function fail(textValue: string): ToolResult {
  return { content: [{ type: "text", text: textValue }], isError: true };
}

async function guard(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof P4PilotError) {
      const detail = error.detail ? ` — ${error.detail}` : "";
      return fail(`p4pilot error [${error.code}]: ${error.message}${detail}`);
    }
    return fail(`internal error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- pure handlers (unit-tested directly) ---

export async function status(ctx: ToolContext): Promise<ToolResult> {
  const opened = await ctx.client.opened();
  if (opened.length === 0) return ok("No files are currently open.");
  const lines = opened.map((file) => `${file.action}\t${file.depotFile} (change ${file.change})`);
  return ok(`${opened.length} open file(s):\n${lines.join("\n")}`);
}

export async function smartEdit(
  ctx: ToolContext,
  args: { paths: string[]; changelist?: string },
): Promise<ToolResult> {
  const results = await ensureOpenForEditMany(
    ctx.client,
    args.paths,
    args.changelist === undefined ? undefined : { changelist: args.changelist },
  );
  const lines = results.map((result) => {
    const cl = result.changelist ? ` [cl ${result.changelist}]` : "";
    const warn =
      result.asset && !result.asset.shouldRead
        ? `  ⚠ ${result.asset.kind} — edit carefully (${result.asset.reason})`
        : "";
    return `${result.status}\t${result.path}${cl}${warn}`;
  });
  return ok(`Ensured ${results.length} path(s) open for edit:\n${lines.join("\n")}`);
}

async function openOp(
  ctx: ToolContext,
  op: "edit" | "add",
  args: { paths: string[]; changelist?: string },
): Promise<ToolResult> {
  const opts = args.changelist === undefined ? undefined : { changelist: args.changelist };
  const opened =
    op === "edit" ? await ctx.client.edit(args.paths, opts) : await ctx.client.add(args.paths, opts);
  return ok(`p4 ${op}: ${opened.map((file) => file.depotFile).join(", ") || "(none)"}`);
}

export async function revert(ctx: ToolContext, args: { paths: string[] }): Promise<ToolResult> {
  const reverted = await ctx.client.revert(args.paths);
  return ok(`Reverted: ${reverted.join(", ") || "(none)"}`);
}

export async function changelistCreate(
  ctx: ToolContext,
  args: { description: string },
): Promise<ToolResult> {
  const description = buildChangelistDescription(args.description, ctx.config.defaultChangelistPrefix);
  const change = await ctx.client.newChangelist(description);
  return ok(`Created pending changelist ${change}: ${description}`);
}

export async function changelistList(
  ctx: ToolContext,
  args: { status?: "pending" | "submitted"; max?: number },
): Promise<ToolResult> {
  const changes = await ctx.client.changes({ status: args.status, max: args.max });
  if (changes.length === 0) return ok("No changelists found.");
  return ok(changes.map((cl) => `${cl.change}\t${cl.status}\t${cl.description}`).join("\n"));
}

function formatDescribe(
  change: string,
  user: string | undefined,
  description: string,
  files: string,
  diff?: string,
): string {
  const head = `Change ${change} by ${user ?? "unknown"}\n${description}\nFiles:\n${files}`;
  return diff ? `${head}\n\nDiff:\n${diff}` : head;
}

export async function describe(
  ctx: ToolContext,
  args: { change: string; diff?: boolean },
): Promise<ToolResult> {
  const result = await ctx.client.describe(args.change, args.diff ? { diff: true } : undefined);
  const files = result.files.map((file) => `  ${file.action}\t${file.depotFile}`).join("\n");
  return ok(formatDescribe(result.change, result.user, result.description, files, result.diff));
}

export async function review(ctx: ToolContext, args: { change: string }): Promise<ToolResult> {
  const result = await ctx.client.describe(args.change, { diff: true });
  const files = result.files.map((file) => `  ${file.action}\t${file.depotFile}`).join("\n");
  const diff = result.diff ?? "(no diff available)";
  return ok(
    `Review of change ${result.change} — ${result.files.length} file(s), by ${result.user ?? "unknown"}\n` +
      `${result.description}\n\nFiles:\n${files}\n\nDiff:\n${diff}`,
  );
}

export async function assetInfo(ctx: ToolContext, args: { path: string }): Promise<ToolResult> {
  const [stat] = await ctx.client.fstat([args.path]);
  const asset = classifyAsset(args.path, { stat });
  const lines = [
    `path: ${args.path}`,
    `kind: ${asset.kind}`,
    `filetype: ${asset.filetype ?? "unknown"}`,
    `tracked: ${stat?.isTracked ?? false}`,
    `headRev: ${stat?.headRev ?? "-"}`,
    `shouldRead: ${asset.shouldRead}`,
    `reason: ${asset.reason}`,
  ];
  const note = asset.shouldRead
    ? ""
    : "\n\n(binary / large asset — content withheld; act on the metadata above, do not read bytes)";
  return ok(lines.join("\n") + note);
}

export async function filelog(
  ctx: ToolContext,
  args: { path: string; max?: number },
): Promise<ToolResult> {
  const log = await ctx.client.filelog(
    args.path,
    args.max === undefined ? undefined : { max: args.max },
  );
  if (log.length === 0) return ok(`No history for ${args.path}.`);
  return ok(
    log
      .map(
        (entry) =>
          `#${entry.rev} change ${entry.change} ${entry.action} by ${entry.user}: ${entry.description}`,
      )
      .join("\n"),
  );
}

export async function search(
  ctx: ToolContext,
  args: { query: string; glob?: string },
): Promise<ToolResult> {
  const hits = await ctx.search(args.query, args.glob === undefined ? undefined : { glob: args.glob });
  const visible = hits.filter((hit) => classifyAsset(hit.file).shouldRead);
  if (visible.length === 0) return ok(`No matches for "${args.query}".`);
  return ok(
    `${visible.length} match(es) for "${args.query}":\n` +
      visible.map((hit) => `${hit.file}:${hit.line}: ${hit.text}`).join("\n"),
  );
}

// --- registration ---

export function registerTools(server: McpServer, ctx: ToolContext): void {
  const paths = z.array(z.string()).min(1);
  const changelist = z.string().optional();

  server.registerTool(
    "p4_status",
    { title: "Perforce status", description: "List files currently open in the workspace." },
    () => guard(() => status(ctx)),
  );
  server.registerTool(
    "p4_smart_edit",
    {
      title: "Smart checkout",
      description: "Ensure the given files are open for edit (or add) before modifying them.",
      inputSchema: { paths, changelist },
    },
    (args) => guard(() => smartEdit(ctx, args)),
  );
  server.registerTool(
    "p4_edit",
    { title: "p4 edit", description: "Open files for edit.", inputSchema: { paths, changelist } },
    (args) => guard(() => openOp(ctx, "edit", args)),
  );
  server.registerTool(
    "p4_add",
    { title: "p4 add", description: "Open new files for add.", inputSchema: { paths, changelist } },
    (args) => guard(() => openOp(ctx, "add", args)),
  );
  server.registerTool(
    "p4_revert",
    {
      title: "p4 revert",
      description: "Revert opened files.",
      inputSchema: { paths: z.array(z.string()).min(1) },
    },
    (args) => guard(() => revert(ctx, args)),
  );
  server.registerTool(
    "p4_changelist_create",
    {
      title: "Create changelist",
      description: "Create a pending changelist with a description.",
      inputSchema: { description: z.string().min(1) },
    },
    (args) => guard(() => changelistCreate(ctx, args)),
  );
  server.registerTool(
    "p4_changelist_list",
    {
      title: "List changelists",
      description: "List pending or submitted changelists.",
      inputSchema: {
        status: z.enum(["pending", "submitted"]).optional(),
        max: z.number().int().positive().optional(),
      },
    },
    (args) => guard(() => changelistList(ctx, args)),
  );
  server.registerTool(
    "p4_describe",
    {
      title: "Describe changelist",
      description: "Show a changelist's metadata and files (optionally a diff).",
      inputSchema: { change: z.string(), diff: z.boolean().optional() },
    },
    (args) => guard(() => describe(ctx, args)),
  );
  server.registerTool(
    "p4_review",
    {
      title: "Review changelist",
      description: "Turn a changelist into a review-ready diff summary.",
      inputSchema: { change: z.string() },
    },
    (args) => guard(() => review(ctx, args)),
  );
  server.registerTool(
    "p4_asset_info",
    {
      title: "Asset info",
      description: "Classify a file; for binary/large assets return metadata instead of bytes.",
      inputSchema: { path: z.string() },
    },
    (args) => guard(() => assetInfo(ctx, args)),
  );
  server.registerTool(
    "p4_filelog",
    {
      title: "File history",
      description: "Show a file's revision history.",
      inputSchema: { path: z.string(), max: z.number().int().positive().optional() },
    },
    (args) => guard(() => filelog(ctx, args)),
  );
  server.registerTool(
    "p4_search",
    {
      title: "Depot search",
      description: "Text-search the workspace, skipping binary assets.",
      inputSchema: { query: z.string().min(1), glob: z.string().optional() },
    },
    (args) => guard(() => search(ctx, args)),
  );
}
