import type { DescribeResult } from "@p4pilot/core/browser";
import type { DiffRow } from "../diff.js";
import type {
  AssetInfoData,
  P4PilotBackend,
  ReviewData,
  WorkspaceSnapshot,
} from "./types.js";

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

interface ErrorResponse {
  error?: { code?: string; message?: string };
}

function rowsForFile(
  diff: string | undefined,
  depotFile: string,
  fileCount: number,
): DiffRow[] {
  if (!diff) return [];
  const rows: DiffRow[] = [];
  let active = fileCount === 1;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("==== ")) {
      active = line.includes(depotFile);
    } else if (line.startsWith("--- ")) {
      active = line.includes(depotFile) || line.includes("/dev/null");
    } else if (line.startsWith("+++ ")) {
      active = line.includes(depotFile);
    } else if (line.startsWith("@@")) {
      continue;
    } else if (active && line.startsWith("+") && !line.startsWith("+++")) {
      rows.push({ type: "add", text: line.slice(1) });
    } else if (active && line.startsWith("-") && !line.startsWith("---")) {
      rows.push({ type: "del", text: line.slice(1) });
    } else if (active && line.startsWith(" ")) {
      rows.push({ type: "ctx", text: line.slice(1) });
    }
  }
  return rows;
}

export class HttpBackend implements P4PilotBackend {
  readonly #baseUrl: string;
  readonly #fetch: Fetcher;

  constructor(baseUrl: string, fetcher: Fetcher = fetch) {
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#fetch = fetcher;
  }

  getWorkspace(): Promise<WorkspaceSnapshot> {
    return this.#request("/api/workspace");
  }

  async smartEdit(clientFile: string, changelist?: string): Promise<unknown> {
    return this.#request("/api/smart-edit", {
      method: "POST",
      body: JSON.stringify({ path: clientFile, changelist }),
    });
  }

  async createChangelist(description: string): Promise<string> {
    const result = await this.#request<{ change: string }>("/api/changelists", {
      method: "POST",
      body: JSON.stringify({ description }),
    });
    return result.change;
  }

  revert(clientFile: string): Promise<unknown> {
    return this.#request("/api/revert", {
      method: "POST",
      body: JSON.stringify({ path: clientFile }),
    });
  }

  assetInfo(path: string): Promise<AssetInfoData> {
    return this.#request(`/api/asset-info?path=${encodeURIComponent(path)}`);
  }

  async review(change: string): Promise<ReviewData> {
    const result = await this.#request<DescribeResult>(
      `/api/review?change=${encodeURIComponent(change)}`,
    );
    return {
      change: result.change,
      description: result.description,
      user: result.user,
      files: result.files.map((file) => ({
        depotFile: file.depotFile,
        action: file.action,
        rows: rowsForFile(result.diff, file.depotFile, result.files.length),
      })),
    };
  }

  async #request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        ...init,
        headers: {
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers,
        },
      });
    } catch (error) {
      throw new Error(
        `p4pilot host disconnected: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    const body = (await response.json()) as T & ErrorResponse;
    if (!response.ok) {
      const code = body.error?.code ?? `HTTP_${response.status}`;
      const message = body.error?.message ?? response.statusText;
      throw new Error(`${code}: ${message}`);
    }
    return body;
  }
}
