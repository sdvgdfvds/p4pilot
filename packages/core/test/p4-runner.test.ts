import { beforeEach, describe, expect, it, vi } from "vitest";

const execaMock = vi.hoisted(() => vi.fn());

vi.mock("execa", () => ({ execa: execaMock }));

import { ExecaP4Runner } from "../src/p4-runner.js";
import { P4PilotError } from "../src/types.js";

describe("ExecaP4Runner", () => {
  beforeEach(() => {
    execaMock.mockReset();
  });

  it("injects -ztag and merges constructor and call environment", async () => {
    execaMock.mockResolvedValue({ stdout: "out", stderr: "", exitCode: 0 });
    const runner = new ExecaP4Runner({
      p4Path: "custom-p4",
      env: { P4PORT: "ssl:p4:1666" },
    });

    await expect(
      runner.run(["change", "-i"], {
        cwd: "/ws",
        input: "Change: new",
        env: { P4USER: "alice" },
      }),
    ).resolves.toEqual({ stdout: "out", stderr: "", exitCode: 0 });
    expect(execaMock).toHaveBeenCalledWith(
      "custom-p4",
      ["-ztag", "change", "-i"],
      {
        cwd: "/ws",
        input: "Change: new",
        env: { P4PORT: "ssl:p4:1666", P4USER: "alice" },
        reject: false,
      },
    );
  });

  it("returns non-zero exits without throwing", async () => {
    execaMock.mockResolvedValue({
      stdout: "",
      stderr: "permission denied",
      exitCode: 1,
    });
    await expect(new ExecaP4Runner().run(["info"])).resolves.toEqual({
      stdout: "",
      stderr: "permission denied",
      exitCode: 1,
    });
  });

  it("treats a signal-terminated process as a failed result", async () => {
    execaMock.mockResolvedValue({
      stdout: "",
      stderr: "terminated",
      exitCode: undefined,
    });
    await expect(new ExecaP4Runner().run(["info"])).resolves.toMatchObject({
      exitCode: 1,
    });
  });

  it("maps ENOENT to P4_NOT_FOUND", async () => {
    execaMock.mockRejectedValue(
      Object.assign(new Error("spawn p4 ENOENT"), { code: "ENOENT" }),
    );
    await expect(new ExecaP4Runner().run(["info"])).rejects.toEqual(
      expect.objectContaining<P4PilotError>({ code: "P4_NOT_FOUND" }),
    );
  });

  it("rethrows unexpected process errors", async () => {
    const error = new Error("process setup failed");
    execaMock.mockRejectedValue(error);
    await expect(new ExecaP4Runner().run(["info"])).rejects.toBe(error);
  });
});
