import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { classifyAsset, type P4Client } from "@p4pilot/core";

import type { Searcher, SearchHit } from "./tools.js";

const IGNORE_DIRS = new Set([".git", "node_modules", ".p4", "dist", ".vs"]);
const MAX_FILE_BYTES = 1_000_000;

function walk(dir: string, onFile: (path: string) => void): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const full = join(dir, name);
    let isDir = false;
    let isFile = false;
    try {
      const stats = statSync(full);
      isDir = stats.isDirectory();
      isFile = stats.isFile();
    } catch {
      continue;
    }
    if (isDir) {
      if (!IGNORE_DIRS.has(name)) walk(full, onFile);
    } else if (isFile) {
      onFile(full);
    }
  }
}

/**
 * Real-mode searcher: walks the Perforce client root (from `p4 info`) and
 * regex-matches text files, skipping binary/large assets. Injectable so tests
 * never touch the filesystem.
 */
export function createNodeSearcher(client: P4Client): Searcher {
  return async (query, _opts) => {
    const info = await client.info();
    const root = info.clientRoot;
    if (root === undefined || root.length === 0) return [];

    const regex = new RegExp(query);
    const hits: SearchHit[] = [];
    walk(root, (file) => {
      if (!classifyAsset(file).shouldRead) return;
      let content: string;
      try {
        if (statSync(file).size > MAX_FILE_BYTES) return;
        content = readFileSync(file, "utf8");
      } catch {
        return;
      }
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]!;
        if (regex.test(line)) hits.push({ file, line: index + 1, text: line.trim() });
      }
    });
    return hits;
  };
}
