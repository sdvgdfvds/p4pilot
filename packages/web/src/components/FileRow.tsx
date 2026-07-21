import type { FileView } from "../backend/types.js";
import {
  FileCode2,
  Info,
  LoaderCircle,
  Package,
  PencilLine,
  ShieldAlert,
  Undo2,
} from "lucide-react";

export function FileRow({
  file,
  pending,
  onCheckout,
  onInspect,
  onRevert,
}: {
  file: FileView;
  pending: boolean;
  onCheckout: (clientFile: string) => void;
  onInspect: (clientFile: string) => void;
  onRevert: (clientFile: string) => void;
}) {
  const kindIcon =
    file.kind === "text" ? (
      <FileCode2 size={14} />
    ) : file.kind === "binary" ? (
      <Package size={14} />
    ) : (
      <ShieldAlert size={14} />
    );
  return (
    <tr>
      <td>
        <span className={`badge ${file.kind}`}>
          {kindIcon}
          {file.kind}
        </span>
      </td>
      <td className="file-path">{file.depotFile}</td>
      <td>
        <span className={`file-status ${file.opened ? "opened" : "closed"}`}>
          {file.opened ? `${file.action} · CL ${file.change}` : "Not opened"}
        </span>
      </td>
      <td className="row-actions-cell">
        <div className="row-actions">
          {file.opened ? (
            <button
              className="icon-button"
              aria-label="Revert"
              title="Revert"
              onClick={() => onRevert(file.clientFile)}
              disabled={pending}
            >
              {pending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Undo2 size={16} />
              )}
            </button>
          ) : (
            <button
              className="icon-button primary"
              aria-label="Smart checkout"
              title="Smart checkout"
              onClick={() => onCheckout(file.clientFile)}
              disabled={pending}
            >
              {pending ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <PencilLine size={16} />
              )}
            </button>
          )}
          {!file.shouldRead && (
            <button
              className="icon-button"
              aria-label="Asset info"
              title="Asset info"
              onClick={() => onInspect(file.clientFile)}
              disabled={pending}
            >
              <Info size={16} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
