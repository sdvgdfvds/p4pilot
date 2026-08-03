import {
  createAuditSinkFromEnv,
  DEFAULT_SAFETY_POLICY,
  ExecaP4Runner,
  loadConfig,
  P4Client,
  READ_ONLY_POLICY,
  RESTRICTED_AGENT_POLICY,
  type AuditSink,
  type P4PilotConfig,
  type SafetyPolicy,
} from "@p4pilot/core";
import { MockP4Runner } from "@p4pilot/core/testing";

import { createMockDepot } from "./mock-depot.js";

export interface BuiltCore {
  client: P4Client;
  config: P4PilotConfig;
  mock: boolean;
  policy: SafetyPolicy;
  audit: AuditSink;
}

function cleanEnv(env: P4PilotConfig["env"]): Record<string, string> {
  const out: Record<string, string> = {};
  if (env.P4PORT) out.P4PORT = env.P4PORT;
  if (env.P4CLIENT) out.P4CLIENT = env.P4CLIENT;
  if (env.P4USER) out.P4USER = env.P4USER;
  return out;
}

/**
 * Resolve {@link SafetyPolicy} from `P4PILOT_POLICY`.
 * Accepted values: `default` (default), `restricted-agent`, `read-only`.
 */
export function resolveSafetyPolicy(env: NodeJS.ProcessEnv): SafetyPolicy {
  const raw = (env.P4PILOT_POLICY ?? "default").trim().toLowerCase();
  switch (raw) {
    case "default":
      return DEFAULT_SAFETY_POLICY;
    case "restricted-agent":
      return RESTRICTED_AGENT_POLICY;
    case "read-only":
      return READ_ONLY_POLICY;
    default:
      throw new Error(
        `unknown P4PILOT_POLICY "${env.P4PILOT_POLICY}" (expected default | restricted-agent | read-only)`,
      );
  }
}

/**
 * Build the core client from CLI args + environment. `--mock` (or
 * `P4PILOT_MOCK=1`) uses an in-memory fake depot so the server runs with no
 * Perforce installed; otherwise a real `p4` runner is used.
 */
export function buildCore(argv: string[], env: NodeJS.ProcessEnv): BuiltCore {
  const config = loadConfig({ env });
  const mock = config.mock || argv.includes("--mock");
  const policy = resolveSafetyPolicy(env);
  const audit = createAuditSinkFromEnv(env);
  if (mock) {
    return {
      client: new P4Client(new MockP4Runner(createMockDepot())),
      config,
      mock: true,
      policy,
      audit,
    };
  }
  const client = new P4Client(
    new ExecaP4Runner({ p4Path: config.p4Path, env: cleanEnv(config.env) }),
  );
  return { client, config, mock: false, policy, audit };
}
