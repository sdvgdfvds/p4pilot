import { useState } from "react";
import { useDemo } from "../demo/useDemo.js";
import { AssetInfoCard, type AssetInfo } from "./AssetInfoCard.js";
import { ChangelistList } from "./ChangelistList.js";
import { FileRow } from "./FileRow.js";

export function Dashboard() {
  const { files, changelists, ready, smartEdit, createChangelist, store } = useDemo();
  const [asset, setAsset] = useState<AssetInfo | null>(null);

  if (!ready) return <p>Loading fake depot…</p>;

  return (
    <div>
      <table>
        <thead><tr><th>kind</th><th>depot file</th><th>opened</th><th>actions</th></tr></thead>
        <tbody>
          {files.map((file) => (
            <FileRow
              key={file.depotFile}
              file={file}
              onCheckout={(cf) => void smartEdit(cf)}
              onInspect={(cf) => void store.assetInfo(cf).then(setAsset)}
            />
          ))}
        </tbody>
      </table>
      <ChangelistList changelists={changelists} onCreate={(d) => void createChangelist(d)} />
      {asset && <AssetInfoCard info={asset} onClose={() => setAsset(null)} />}
    </div>
  );
}
