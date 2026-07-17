import type { FileView } from "../demo/store.js";

export function FileRow({ file, onCheckout, onInspect }: {
  file: FileView;
  onCheckout: (clientFile: string) => void;
  onInspect: (clientFile: string) => void;
}) {
  return (
    <tr>
      <td><span className={`badge ${file.kind}`}>{file.kind}</span></td>
      <td>{file.depotFile}</td>
      <td>{file.opened ? `${file.action} @ ${file.change}` : "—"}</td>
      <td>
        <button onClick={() => onCheckout(file.clientFile)} disabled={file.opened}>Smart checkout</button>
        {!file.shouldRead && <button onClick={() => onInspect(file.clientFile)}>Asset info</button>}
      </td>
    </tr>
  );
}
