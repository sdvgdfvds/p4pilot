import type { AssetInfoData } from "../demo/store.js";
import { ShieldAlert, X } from "lucide-react";

export function AssetInfoCard({
  info,
  onClose,
}: {
  info: AssetInfoData;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="asset-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-title"
        data-testid="asset-info"
      >
        <div className="dialog-heading">
          <span className="asset-icon" aria-hidden="true">
            <ShieldAlert size={18} />
          </span>
          <div>
            <h3 id="asset-title">Guarded asset</h3>
            <p>{info.path}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Close asset info"
            title="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <dl className="asset-details">
          <div>
            <dt>Kind</dt>
            <dd>{info.kind}</dd>
          </div>
          <div>
            <dt>File type</dt>
            <dd>{info.filetype ?? "unknown"}</dd>
          </div>
          <div>
            <dt>Head revision</dt>
            <dd>{info.headRev ?? "-"}</dd>
          </div>
          <div>
            <dt>Tracked</dt>
            <dd>{String(info.tracked)}</dd>
          </div>
          <div className="detail-wide">
            <dt>Classification reason</dt>
            <dd>{info.reason}</dd>
          </div>
        </dl>
        {!info.shouldRead && (
          <p className="withheld-note">
            <ShieldAlert size={16} />
            Content withheld. Operate on metadata; do not read asset bytes.
          </p>
        )}
      </aside>
    </div>
  );
}
