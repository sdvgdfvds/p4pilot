import type { P4Result, P4Runner, P4RunOptions } from "../p4-runner.js";
import type { ChangelistSummary, P4Action } from "../types.js";

export interface FakeFile {
  depotFile: string;
  clientFile: string;
  headType?: string;
  headRev?: number;
  sizeBytes?: number;
  opened?: { action: P4Action; change: string };
}

export interface FakeDepotState {
  root: string;
  port?: string;
  client?: string;
  user?: string;
  files: FakeFile[];
  changelists?: ChangelistSummary[];
  shelvedChangelists?: FakeShelvedChangelist[];
}

export interface FakeShelvedFile {
  depotFile: string;
  action: P4Action;
  rev?: number;
  type?: string;
  diff?: string;
}

export interface FakeShelvedChangelist {
  change: string;
  description: string;
  user?: string;
  client?: string;
  files: FakeShelvedFile[];
}

type ZtagField = readonly [key: string, value: string | number | undefined];

const success = (stdout = ""): P4Result => ({
  stdout,
  stderr: "",
  exitCode: 0,
});
const failure = (stderr: string): P4Result => ({
  stdout: "",
  stderr,
  exitCode: 1,
});

function formatRecord(fields: ZtagField[]): string {
  return fields
    .filter(
      (field): field is readonly [string, string | number] =>
        field[1] !== undefined,
    )
    .map(([key, rawValue]) => {
      const [firstLine = "", ...continuationLines] =
        String(rawValue).split("\n");
      return [`... ${key} ${firstLine}`, ...continuationLines].join("\n");
    })
    .join("\n");
}

function formatRecords(records: ZtagField[][]): string {
  if (records.length === 0) {
    return "";
  }
  return `${records.map(formatRecord).join("\n\n")}\n`;
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

/** Pure POSIX `path.relative` for absolute, normalized paths (no node:path). */
function relativePosix(from: string, to: string): string {
  const fromParts = from.replace(/\/+$/, "").split("/").filter(Boolean);
  const toParts = to.split("/").filter(Boolean);
  let i = 0;
  while (
    i < fromParts.length &&
    i < toParts.length &&
    fromParts[i] === toParts[i]
  )
    i += 1;
  const up = fromParts.slice(i).map(() => "..");
  return [...up, ...toParts.slice(i)].join("/");
}

function parseCommandFiles(args: string[]): {
  change: string;
  files: string[];
} {
  let change = "default";
  const files: string[] = [];

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === "-c") {
      change = args[index + 1] ?? "default";
      index += 1;
    } else if (!argument.startsWith("-")) {
      files.push(argument);
    }
  }

  return { change, files };
}

export class MockP4Runner implements P4Runner {
  readonly #state: FakeDepotState;

  constructor(state: FakeDepotState) {
    this.#state = state;
  }

  get state(): FakeDepotState {
    return this.#state;
  }

  async run(args: string[], opts?: P4RunOptions): Promise<P4Result> {
    const commandArgs = args[0] === "-ztag" ? args.slice(1) : [...args];
    const command = commandArgs[0];

    switch (command) {
      case "info":
        return this.runInfo();
      case "fstat":
        return this.runFstat(commandArgs);
      case "opened":
        return this.runOpened(commandArgs);
      case "edit":
        return this.runEdit(commandArgs);
      case "add":
        return this.runAdd(commandArgs);
      case "delete":
        return this.runDelete(commandArgs);
      case "revert":
        return this.runRevert(commandArgs);
      case "reopen":
        return this.runReopen(commandArgs);
      case "where":
        return this.runWhere(commandArgs);
      case "changes":
        return this.runChanges(commandArgs);
      case "describe":
        return this.runDescribe(commandArgs);
      case "diff":
        return success();
      case "change":
        return this.runChange(commandArgs, opts);
      case "sync":
        return this.runSync(commandArgs);
      case "filelog":
        return this.runFilelog(commandArgs);
      default:
        return failure(`Unsupported mock p4 command: ${command ?? ""}`);
    }
  }

  private runInfo(): P4Result {
    return success(
      formatRecords([
        [
          ["userName", this.#state.user],
          ["clientName", this.#state.client],
          ["clientRoot", this.#state.root],
          ["serverAddress", this.#state.port],
        ],
      ]),
    );
  }

  private runFstat(args: string[]): P4Result {
    const requested = args
      .slice(1)
      .filter((argument) => !argument.startsWith("-"));
    const files =
      requested.length === 0
        ? this.#state.files
        : requested.flatMap((file) => this.findFiles(file));

    return success(
      formatRecords(files.map((file) => this.fileStatFields(file))),
    );
  }

  private runOpened(args: string[]): P4Result {
    const { files } = parseCommandFiles(args);
    const changeIndex = args.indexOf("-c");
    const requestedChange =
      changeIndex === -1 ? undefined : args[changeIndex + 1];
    const openedFiles = this.#state.files.filter((file) => {
      if (file.opened === undefined) {
        return false;
      }
      if (
        requestedChange !== undefined &&
        file.opened.change !== requestedChange
      ) {
        return false;
      }
      return (
        files.length === 0 ||
        files.some((requested) => this.matches(file, requested))
      );
    });

    return success(
      formatRecords(openedFiles.map((file) => this.openedFields(file))),
    );
  }

  private runEdit(args: string[]): P4Result {
    const { change, files } = parseCommandFiles(args);
    const edited: FakeFile[] = [];

    for (const requested of files) {
      const file = this.findFile(requested);
      if (file === undefined || file.headRev === undefined) {
        return failure(`${requested} - no such file(s).`);
      }
      file.opened = { action: "edit", change };
      edited.push(file);
    }

    return success(
      formatRecords(edited.map((file) => this.openedFields(file))),
    );
  }

  private runAdd(args: string[]): P4Result {
    const { change, files } = parseCommandFiles(args);
    const added: FakeFile[] = [];

    for (const requested of files) {
      let file = this.findFile(requested);
      if (file === undefined) {
        const clientFile = normalizePath(requested);
        file = {
          depotFile: this.toDepotFile(clientFile),
          clientFile,
          headType: "text",
        };
        this.#state.files.push(file);
      }
      file.opened = { action: "add", change };
      added.push(file);
    }

    return success(formatRecords(added.map((file) => this.openedFields(file))));
  }

  private runDelete(args: string[]): P4Result {
    const { change, files } = parseCommandFiles(args);
    const deleted: FakeFile[] = [];

    for (const requested of files) {
      const file = this.findFile(requested);
      if (file === undefined || file.headRev === undefined) {
        return failure(`${requested} - no such file(s).`);
      }
      file.opened = { action: "delete", change };
      deleted.push(file);
    }

    return success(
      formatRecords(deleted.map((file) => this.openedFields(file))),
    );
  }

  private runRevert(args: string[]): P4Result {
    const { files } = parseCommandFiles(args);
    const reverted: ZtagField[][] = [];

    for (const requested of files) {
      const fileIndex = this.#state.files.findIndex((file) =>
        this.matches(file, requested),
      );
      const file = this.#state.files[fileIndex];
      if (file === undefined || file.opened === undefined) {
        continue;
      }

      reverted.push([["depotFile", file.depotFile]]);
      if (file.opened.action === "add" && file.headRev === undefined) {
        this.#state.files.splice(fileIndex, 1);
      } else {
        delete file.opened;
      }
    }

    return success(formatRecords(reverted));
  }

  private runReopen(args: string[]): P4Result {
    const { change, files } = parseCommandFiles(args);
    const reopened: FakeFile[] = [];

    for (const requested of files) {
      const file = this.findFile(requested);
      if (file === undefined || file.opened === undefined) {
        return failure(`${requested} - file(s) not opened on this client.`);
      }
      file.opened = { ...file.opened, change };
      reopened.push(file);
    }

    return success(
      formatRecords(reopened.map((file) => this.openedFields(file))),
    );
  }

  private runWhere(args: string[]): P4Result {
    const requested = args.find(
      (argument, index) => index > 0 && !argument.startsWith("-"),
    );
    const file = requested === undefined ? undefined : this.findFile(requested);
    if (file === undefined) {
      return failure(`${requested ?? ""} - file(s) not in client view.`);
    }

    return success(
      formatRecords([
        [
          ["depotFile", file.depotFile],
          ["clientFile", file.clientFile],
          ["path", file.clientFile],
        ],
      ]),
    );
  }

  private runChanges(args: string[]): P4Result {
    let status: string | undefined;
    let max: number | undefined;

    for (let index = 1; index < args.length; index += 1) {
      if (args[index] === "-s") {
        status = args[index + 1];
        index += 1;
      } else if (args[index] === "-m") {
        max = Number(args[index + 1]);
        index += 1;
      }
    }

    let changelists = [...(this.#state.changelists ?? [])];
    if (status !== undefined) {
      changelists = changelists.filter(
        (changelist) => changelist.status === status,
      );
    }
    if (max !== undefined && Number.isFinite(max)) {
      changelists = changelists.slice(0, max);
    }

    return success(
      formatRecords(
        changelists.map((changelist) => [
          ["change", changelist.change],
          ["desc", changelist.description],
          ["status", changelist.status],
          ["user", changelist.user],
          ["client", changelist.client],
        ]),
      ),
    );
  }

  private runDescribe(args: string[]): P4Result {
    const change = [...args]
      .reverse()
      .find((argument) => !argument.startsWith("-"));
    if (args.includes("-S")) {
      return this.runDescribeShelved(change);
    }
    const changelist = this.#state.changelists?.find(
      (item) => item.change === change,
    );
    if (changelist === undefined) {
      return failure(`Change ${change ?? ""} unknown.`);
    }

    const fields: ZtagField[] = [
      ["change", changelist.change],
      ["desc", changelist.description],
      ["user", changelist.user],
      ["status", changelist.status],
    ];

    for (const [index, depotFile] of (changelist.files ?? []).entries()) {
      const file = this.findFile(depotFile);
      fields.push([`depotFile${index}`, depotFile]);
      fields.push([`action${index}`, file?.opened?.action ?? "edit"]);
      fields.push([`rev${index}`, file?.headRev]);
    }

    return success(formatRecords([fields]));
  }

  private runDescribeShelved(change: string | undefined): P4Result {
    const changelist = this.#state.shelvedChangelists?.find(
      (item) => item.change === change,
    );
    if (changelist === undefined) {
      return failure(`Change ${change ?? ""} has no shelved files.`);
    }

    const fields: ZtagField[] = [
      ["change", changelist.change],
      ["desc", changelist.description],
      ["user", changelist.user],
      ["client", changelist.client],
      ["status", "pending"],
      ["shelved", "1"],
    ];
    for (const [index, file] of changelist.files.entries()) {
      fields.push([`depotFile${index}`, file.depotFile]);
      fields.push([`action${index}`, file.action]);
      fields.push([`rev${index}`, file.rev]);
      fields.push([`type${index}`, file.type]);
    }

    const records = [formatRecord(fields)];
    for (const file of changelist.files) {
      if (file.diff === undefined) continue;
      records.push(
        `${formatRecord([
          ["depotFile", file.depotFile],
          ["rev", file.rev],
          ["type", file.type],
        ])}\n${file.diff}`,
      );
    }
    return success(`${records.join("\n\n")}\n`);
  }

  private runChange(args: string[], opts?: P4RunOptions): P4Result {
    if (!args.includes("-i")) {
      return failure("MockP4Runner only supports change -i.");
    }

    const changelists = this.#state.changelists ?? [];
    this.#state.changelists = changelists;
    const nextChange = String(
      changelists.reduce((highest, changelist) => {
        const value = Number(changelist.change);
        return Number.isFinite(value) ? Math.max(highest, value) : highest;
      }, 0) + 1,
    );
    const description = this.parseDescription(opts?.input ?? "");
    changelists.push({
      change: nextChange,
      description,
      status: "pending",
      user: this.#state.user,
      client: this.#state.client,
      files: [],
    });

    return success(formatRecords([[["change", nextChange]]]));
  }

  private runSync(args: string[]): P4Result {
    const requested = args
      .slice(1)
      .filter((argument) => !argument.startsWith("-"));
    const files =
      requested.length === 0
        ? this.#state.files
        : requested.flatMap((path) => this.findFiles(path));
    const records: ZtagField[][] = files
      .filter((file) => file.headRev !== undefined)
      .map((file) => [
        ["depotFile", file.depotFile],
        ["rev", file.headRev],
      ]);
    return success(formatRecords(records));
  }

  private runFilelog(args: string[]): P4Result {
    const files: string[] = [];
    for (let index = 1; index < args.length; index += 1) {
      const argument = args[index];
      if (argument === "-m") {
        index += 1;
      } else if (argument !== undefined && !argument.startsWith("-")) {
        files.push(argument);
      }
    }
    const requested = files[0];
    const file = requested === undefined ? undefined : this.findFile(requested);
    if (file === undefined || file.headRev === undefined) {
      return failure(`${requested ?? ""} - no such file(s).`);
    }
    const fields: ZtagField[] = [
      ["depotFile", file.depotFile],
      ["rev0", file.headRev],
      ["change0", "1"],
      ["action0", "add"],
      ["user0", this.#state.user],
      ["desc0", "initial revision"],
    ];
    return success(formatRecords([fields]));
  }

  private fileStatFields(file: FakeFile): ZtagField[] {
    return [
      ["depotFile", file.depotFile],
      ["clientFile", file.clientFile],
      ["headType", file.headType],
      ["headRev", file.headRev],
      ["fileSize", file.sizeBytes],
      ["action", file.opened?.action],
      ["change", file.opened?.change],
    ];
  }

  private openedFields(file: FakeFile): ZtagField[] {
    return [
      ["depotFile", file.depotFile],
      ["clientFile", file.clientFile],
      ["rev", file.headRev],
      ["action", file.opened?.action],
      ["change", file.opened?.change],
      ["type", file.headType ?? "text"],
    ];
  }

  private findFiles(requested: string): FakeFile[] {
    return this.#state.files.filter((file) => this.matches(file, requested));
  }

  private findFile(requested: string): FakeFile | undefined {
    return this.#state.files.find((file) => this.matches(file, requested));
  }

  private matches(file: FakeFile, requested: string): boolean {
    const normalized = normalizePath(requested);
    if (normalized.endsWith("/...")) {
      const prefix = normalized.slice(0, -3);
      return (
        normalizePath(file.clientFile).startsWith(prefix) ||
        file.depotFile.startsWith(prefix)
      );
    }
    return (
      normalizePath(file.clientFile) === normalized ||
      file.depotFile === normalized
    );
  }

  private toDepotFile(clientFile: string): string {
    const normalizedRoot = normalizePath(this.#state.root).replace(/\/$/, "");
    const relative = relativePosix(normalizedRoot, clientFile);
    const trackedFile = this.#state.files.find(
      (file) => file.headRev !== undefined,
    );
    if (trackedFile !== undefined) {
      const trackedRelative = relativePosix(
        normalizedRoot,
        normalizePath(trackedFile.clientFile),
      );
      const suffix = `/${trackedRelative}`;
      const depotRoot = trackedFile.depotFile.endsWith(suffix)
        ? trackedFile.depotFile.slice(0, -suffix.length)
        : "//depot";
      return `${depotRoot}/${relative}`;
    }
    return `//depot/${relative}`;
  }

  private parseDescription(input: string): string {
    const lines = input.split(/\r?\n/);
    const descriptionIndex = lines.findIndex((line) =>
      line.startsWith("Description:"),
    );
    if (descriptionIndex === -1) {
      return "";
    }

    const descriptionLines: string[] = [];
    for (const line of lines.slice(descriptionIndex + 1)) {
      if (/^[A-Za-z][A-Za-z0-9-]*:/.test(line)) {
        break;
      }
      descriptionLines.push(line.replace(/^\t/, ""));
    }
    return descriptionLines.join("\n").trim();
  }
}
