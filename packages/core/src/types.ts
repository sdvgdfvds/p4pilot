export type P4Action =
  | "edit"
  | "add"
  | "delete"
  | "branch"
  | "integrate"
  | "move/add"
  | "move/delete";

export interface OpenedFile {
  depotFile: string;
  clientFile?: string;
  rev?: number;
  action: P4Action;
  change: string;
  type: string;
}

export interface FileStat {
  depotFile: string;
  clientFile?: string;
  headType?: string;
  headRev?: number;
  haveRev?: number;
  action?: P4Action;
  isOpened: boolean;
  isTracked: boolean;
}

export interface ChangelistSummary {
  change: string;
  description: string;
  status: "pending" | "submitted" | "shelved";
  user?: string;
  client?: string;
  files?: string[];
}

export interface DescribeResult {
  change: string;
  description: string;
  user?: string;
  files: Array<{ depotFile: string; action: P4Action; rev?: number }>;
  diff?: string;
}

export interface ShelvedReviewResult extends DescribeResult {
  reviewType: "shelved";
}

export class P4PilotError extends Error {
  constructor(
    message: string,
    readonly code: P4PilotErrorCode,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "P4PilotError";
  }
}

export type P4PilotErrorCode =
  | "P4_NOT_FOUND"
  | "P4_COMMAND_FAILED"
  | "NOT_CONNECTED"
  | "FILE_NOT_IN_CLIENT"
  | "NO_SHELVED_FILES"
  | "INVALID_INPUT";
