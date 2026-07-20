import { useRef, useState } from "react";
import {
  FileStack,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { operationKey, useDemo } from "../demo/useDemo.js";
import type { AssetInfoData } from "../demo/store.js";
import { AssetInfoCard } from "./AssetInfoCard.js";
import { ChangelistList } from "./ChangelistList.js";
import { FileRow } from "./FileRow.js";

export function Dashboard() {
  const {
    files,
    changelists,
    ready,
    pending,
    smartEdit,
    createChangelist,
    revert,
    inspectAsset,
  } = useDemo();
  const [asset, setAsset] = useState<AssetInfoData | null>(null);
  const inspection = useRef(0);

  async function showAsset(path: string) {
    const request = ++inspection.current;
    const nextAsset = await inspectAsset(path);
    if (request === inspection.current && nextAsset !== undefined)
      setAsset(nextAsset);
  }

  if (!ready) {
    return (
      <div className="loading-state">
        <LoaderCircle className="spin" size={20} />
        Loading workspace
      </div>
    );
  }

  const opened = files.filter((file) => file.opened).length;
  const guarded = files.filter((file) => !file.shouldRead).length;

  return (
    <section className="dashboard-view" aria-labelledby="workspace-heading">
      <div className="section-heading">
        <div>
          <h2 id="workspace-heading">Workspace</h2>
          <p>p4pilot-demo · //depot/game/...</p>
        </div>
        <div className="workspace-metrics" aria-label="Workspace summary">
          <span>
            <FileStack size={15} /> <strong>{files.length}</strong> tracked
          </span>
          <span>
            <LockKeyhole size={15} /> <strong>{opened}</strong> opened
          </span>
          <span>
            <ShieldCheck size={15} /> <strong>{guarded}</strong> guarded
          </span>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="file-panel" aria-label="Depot files">
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Depot file</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <FileRow
                    key={file.depotFile}
                    file={file}
                    pending={pending.some((key) =>
                      key.endsWith(`:${file.clientFile}`),
                    )}
                    onCheckout={(cf) => void smartEdit(cf)}
                    onRevert={(cf) => void revert(cf)}
                    onInspect={(cf) => void showAsset(cf)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="changelist-panel">
          <ChangelistList
            changelists={changelists}
            creating={pending.includes(operationKey.createChangelist)}
            onCreate={createChangelist}
          />
        </aside>
      </div>
      {asset && (
        <AssetInfoCard
          info={asset}
          onClose={() => {
            inspection.current += 1;
            setAsset(null);
          }}
        />
      )}
    </section>
  );
}
