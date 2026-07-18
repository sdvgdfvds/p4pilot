// Browser-safe subset of @p4pilot/core: no execa, no node:fs, no node:path, no process.
// Deliberately omits ./p4-runner (execa) and ./config (node:fs) at runtime.
export * from "./types.js";
export * from "./ztag.js";
export * from "./p4-client.js";
export * from "./asset-guard.js";
export * from "./auto-checkout.js";
export * from "./changelist.js";
export { MockP4Runner } from "./testing/mock-runner.js";
export type { FakeDepotState, FakeFile } from "./testing/mock-runner.js";
export type { P4Runner, P4Result, P4RunOptions } from "./p4-runner.js"; // type-only → erased
