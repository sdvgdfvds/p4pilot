import type { P4Runner, P4RunOptions } from "./p4-runner.js";
import type {
  ChangelistSummary,
  DescribeResult,
  FileStat,
  OpenedFile,
  P4Action,
} from "./types.js";
import { P4PilotError } from "./types.js";
import { groupIndexed, parseZtag } from "./ztag.js";

/** A single revision entry returned by {@link P4Client.filelog}. */
export interface FilelogEntry {
  rev: number;
  change: string;
  action: P4Action;
  user: string;
  description: string;
}

const CHANGE_CREATED = /Change (\d+) created/;

function num(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function toOpenedFile(record: Map<string, string>): OpenedFile {
  return {
    depotFile: record.get("depotFile") ?? "",
    clientFile: record.get("clientFile"),
    rev: num(record.get("rev")),
    action: (record.get("action") ?? "edit") as P4Action,
    change: record.get("change") ?? "default",
    type: record.get("type") ?? "text",
  };
}

function toFileStat(record: Map<string, string>): FileStat {
  const headRev = num(record.get("headRev"));
  const action = record.get("action") as P4Action | undefined;
  return {
    depotFile: record.get("depotFile") ?? "",
    clientFile: record.get("clientFile"),
    headType: record.get("headType"),
    headRev,
    haveRev: num(record.get("haveRev")),
    action,
    isOpened: action !== undefined,
    isTracked: headRev !== undefined,
  };
}

function toChangelistSummary(record: Map<string, string>): ChangelistSummary {
  const status = record.get("status");
  return {
    change: record.get("change") ?? "",
    description: record.get("desc") ?? "",
    status: status === "submitted" || status === "shelved" ? status : "pending",
    user: record.get("user"),
    client: record.get("client"),
  };
}

/**
 * Typed wrapper over a {@link P4Runner}. Each method builds `p4` args, runs them,
 * parses the `-ztag` output, and maps it to a domain type. Non-zero exits raise
 * a {@link P4PilotError} with code `P4_COMMAND_FAILED`.
 */
export class P4Client {
  readonly #runner: P4Runner;

  constructor(runner: P4Runner) {
    this.#runner = runner;
  }

  async #run(args: string[], opts?: P4RunOptions) {
    const result = await this.#runner.run(args, opts);
    if (result.exitCode !== 0) {
      throw new P4PilotError(
        `p4 ${args.join(" ")} failed`,
        "P4_COMMAND_FAILED",
        result.stderr.trim() || result.stdout.trim(),
      );
    }
    return result;
  }

  async info(): Promise<Record<string, string>> {
    const { stdout } = await this.#run(["info"]);
    const record = parseZtag(stdout)[0];
    const info: Record<string, string> = {};
    if (record) {
      for (const [key, value] of record) {
        info[key] = value;
      }
    }
    return info;
  }

  async opened(opts?: { changelist?: string }): Promise<OpenedFile[]> {
    const args = ["opened"];
    if (opts?.changelist) args.push("-c", opts.changelist);
    const { stdout } = await this.#run(args);
    return parseZtag(stdout).map(toOpenedFile);
  }

  async fstat(files: string[]): Promise<FileStat[]> {
    if (files.length === 0) return [];
    const { stdout } = await this.#run(["fstat", ...files]);
    return parseZtag(stdout).map(toFileStat);
  }

  async edit(
    files: string[],
    opts?: { changelist?: string },
  ): Promise<OpenedFile[]> {
    return this.#openOp("edit", files, opts);
  }

  async add(
    files: string[],
    opts?: { changelist?: string },
  ): Promise<OpenedFile[]> {
    return this.#openOp("add", files, opts);
  }

  async deleteFiles(
    files: string[],
    opts?: { changelist?: string },
  ): Promise<OpenedFile[]> {
    return this.#openOp("delete", files, opts);
  }

  async #openOp(
    command: string,
    files: string[],
    opts?: { changelist?: string },
  ): Promise<OpenedFile[]> {
    if (files.length === 0) return [];
    const args = [command];
    if (opts?.changelist) args.push("-c", opts.changelist);
    args.push(...files);
    const { stdout } = await this.#run(args);
    return parseZtag(stdout).map(toOpenedFile);
  }

  async revert(files: string[]): Promise<string[]> {
    if (files.length === 0) return [];
    const { stdout } = await this.#run(["revert", ...files]);
    return parseZtag(stdout)
      .map((record) => record.get("depotFile") ?? "")
      .filter((depotFile) => depotFile.length > 0);
  }

  async sync(paths?: string[]): Promise<{ synced: number }> {
    const args = ["sync"];
    if (paths && paths.length > 0) args.push(...paths);
    const { stdout } = await this.#run(args);
    return { synced: parseZtag(stdout).length };
  }

  async where(
    file: string,
  ): Promise<{ depotFile: string; clientFile: string; path: string }> {
    const { stdout } = await this.#run(["where", file]);
    const record = parseZtag(stdout)[0];
    if (!record) {
      throw new P4PilotError(
        `p4 where returned no mapping for ${file}`,
        "FILE_NOT_IN_CLIENT",
      );
    }
    const clientFile = record.get("clientFile") ?? "";
    return {
      depotFile: record.get("depotFile") ?? "",
      clientFile,
      path: record.get("path") ?? clientFile,
    };
  }

  async changes(opts?: {
    status?: "pending" | "submitted";
    max?: number;
    user?: string;
  }): Promise<ChangelistSummary[]> {
    const args = ["changes"];
    if (opts?.status) args.push("-s", opts.status);
    if (opts?.max !== undefined) args.push("-m", String(opts.max));
    if (opts?.user) args.push("-u", opts.user);
    const { stdout } = await this.#run(args);
    return parseZtag(stdout).map(toChangelistSummary);
  }

  async describe(
    change: string,
    opts?: { diff?: boolean },
  ): Promise<DescribeResult> {
    const args = ["describe"];
    if (opts?.diff) args.push("-du");
    args.push(change);
    const { stdout } = await this.#run(args);
    const record = parseZtag(stdout)[0];
    if (!record) {
      throw new P4PilotError(
        `p4 describe returned nothing for ${change}`,
        "P4_COMMAND_FAILED",
      );
    }
    const grouped = groupIndexed(record);
    const depotFiles = asArray(grouped.depotFile);
    const actions = asArray(grouped.action);
    const revs = asArray(grouped.rev);
    const files = depotFiles.map((depotFile, index) => ({
      depotFile,
      action: (actions[index] ?? "edit") as P4Action,
      rev: revs[index] === undefined ? undefined : Number(revs[index]),
    }));
    return {
      change: str(grouped.change) ?? change,
      description: str(grouped.desc) ?? "",
      user: str(grouped.user),
      files,
      diff: str(grouped.diff),
    };
  }

  async filelog(
    file: string,
    opts?: { max?: number },
  ): Promise<FilelogEntry[]> {
    const args = ["filelog"];
    if (opts?.max !== undefined) args.push("-m", String(opts.max));
    args.push(file);
    const { stdout } = await this.#run(args);
    const record = parseZtag(stdout)[0];
    if (!record) return [];
    const grouped = groupIndexed(record);
    const revs = asArray(grouped.rev);
    const changes = asArray(grouped.change);
    const actions = asArray(grouped.action);
    const users = asArray(grouped.user);
    const descriptions = asArray(grouped.desc);
    return revs.map((rev, index) => ({
      rev: Number(rev),
      change: changes[index] ?? "",
      action: (actions[index] ?? "edit") as P4Action,
      user: users[index] ?? "",
      description: descriptions[index] ?? "",
    }));
  }

  async newChangelist(description: string): Promise<string> {
    const indented = description.replace(/\n/g, "\n\t");
    const spec = `Change:\tnew\n\nDescription:\n\t${indented}\n`;
    const { stdout } = await this.#run(["change", "-i"], { input: spec });
    const matched = CHANGE_CREATED.exec(stdout);
    if (matched?.[1]) return matched[1];
    const change = parseZtag(stdout)[0]?.get("change");
    if (change) return change;
    throw new P4PilotError(
      "could not parse created changelist number",
      "P4_COMMAND_FAILED",
      stdout.trim(),
    );
  }

  async reopen(files: string[], changelist: string): Promise<OpenedFile[]> {
    if (files.length === 0) return [];
    const { stdout } = await this.#run(["reopen", "-c", changelist, ...files]);
    return parseZtag(stdout).map(toOpenedFile);
  }
}
