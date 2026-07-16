import type { FileStat } from "./types.js";

/** How p4pilot classifies a file for agent consumption. */
export type AssetKind = "text" | "binary" | "large-asset";

export interface AssetClassification {
  path: string;
  kind: AssetKind;
  /** p4 filetype when known (e.g. "text", "binary+l"). */
  filetype?: string;
  sizeBytes?: number;
  /** True only for text — agents should not read binary/large-asset bytes. */
  shouldRead: boolean;
  reason: string;
}

export interface AssetGuardConfig {
  binaryExtensions: string[];
  largeAssetExtensions: string[];
  maxTextBytes: number;
}

export const DEFAULT_ASSET_GUARD_CONFIG: AssetGuardConfig = {
  largeAssetExtensions: [
    ".uasset",
    ".umap",
    ".fbx",
    ".psd",
    ".pak",
    ".mp4",
    ".mov",
    ".blend",
    ".exr",
  ],
  binaryExtensions: [
    ".png",
    ".tga",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".dds",
    ".ico",
    ".wav",
    ".mp3",
    ".ogg",
    ".flac",
    ".bin",
    ".dll",
    ".exe",
    ".so",
    ".dylib",
    ".lib",
    ".a",
    ".zip",
    ".7z",
    ".rar",
    ".gz",
    ".pdf",
  ],
  maxTextBytes: 1_000_000,
};

function extname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const base = normalized.slice(normalized.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

function isBinaryFiletype(filetype: string | undefined): boolean {
  if (filetype === undefined) return false;
  return /(binary|ubinary|apple)/i.test(filetype);
}

function build(
  path: string,
  kind: AssetKind,
  filetype: string | undefined,
  sizeBytes: number | undefined,
  reason: string,
): AssetClassification {
  return { path, kind, filetype, sizeBytes, shouldRead: kind === "text", reason };
}

/**
 * Classify a file so an agent knows whether to read its bytes. Decision order:
 * large-asset extension → binary p4 filetype → binary extension → oversized → text.
 */
export function classifyAsset(
  path: string,
  opts?: { stat?: FileStat; sizeBytes?: number; config?: Partial<AssetGuardConfig> },
): AssetClassification {
  const config: AssetGuardConfig = { ...DEFAULT_ASSET_GUARD_CONFIG, ...opts?.config };
  const ext = extname(path);
  const filetype = opts?.stat?.headType;
  const sizeBytes = opts?.sizeBytes;

  if (config.largeAssetExtensions.includes(ext)) {
    return build(path, "large-asset", filetype, sizeBytes, `large-asset extension ${ext}`);
  }
  if (isBinaryFiletype(filetype)) {
    return build(path, "binary", filetype, sizeBytes, `binary p4 filetype ${filetype ?? ""}`);
  }
  if (config.binaryExtensions.includes(ext)) {
    return build(path, "binary", filetype, sizeBytes, `binary extension ${ext}`);
  }
  if (sizeBytes !== undefined && sizeBytes > config.maxTextBytes) {
    return build(
      path,
      "binary",
      filetype,
      sizeBytes,
      `size ${sizeBytes} exceeds maxTextBytes ${config.maxTextBytes}`,
    );
  }
  return build(path, "text", filetype, sizeBytes, ext ? `text extension ${ext}` : "text file");
}
