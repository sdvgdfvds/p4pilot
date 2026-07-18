export interface AssetInfo {
  path: string; kind: string; filetype?: string; tracked: boolean; headRev?: number; shouldRead: boolean; reason: string;
}

export function AssetInfoCard({ info, onClose }: { info: AssetInfo; onClose: () => void }) {
  return (
    <aside data-testid="asset-info">
      <button onClick={onClose}>close</button>
      <dl>
        <dt>path</dt><dd>{info.path}</dd>
        <dt>kind</dt><dd>{info.kind}</dd>
        <dt>filetype</dt><dd>{info.filetype ?? "unknown"}</dd>
        <dt>headRev</dt><dd>{info.headRev ?? "-"}</dd>
        <dt>shouldRead</dt><dd>{String(info.shouldRead)}</dd>
        <dt>reason</dt><dd>{info.reason}</dd>
      </dl>
      {!info.shouldRead && <p>binary / large asset — content withheld; act on the metadata above.</p>}
    </aside>
  );
}
