import { execa } from "execa";

import { P4PilotError } from "./types.js";

export interface P4Result {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface P4RunOptions {
  cwd?: string;
  input?: string;
  env?: Record<string, string>;
}

export interface P4Runner {
  run(args: string[], opts?: P4RunOptions): Promise<P4Result>;
}

export interface ExecaP4RunnerOptions {
  p4Path?: string;
  env?: Record<string, string>;
}

export class ExecaP4Runner implements P4Runner {
  readonly #p4Path: string;
  readonly #env?: Record<string, string>;

  constructor(options: ExecaP4RunnerOptions = {}) {
    this.#p4Path = options.p4Path ?? "p4";
    this.#env = options.env;
  }

  async run(args: string[], opts?: P4RunOptions): Promise<P4Result> {
    try {
      const result = await execa(this.#p4Path, ["-ztag", ...args], {
        input: opts?.input,
        cwd: opts?.cwd,
        env: { ...this.#env, ...opts?.env },
        reject: false,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new P4PilotError("p4 binary not found", "P4_NOT_FOUND");
      }

      throw error;
    }
  }
}
