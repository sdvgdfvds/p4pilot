import { useEffect, useState } from "react";
import { useDemo } from "../demo/useDemo.js";
import type { ReviewData } from "../demo/store.js";
import { DiffView } from "./DiffView.js";

export function ReviewView() {
  const { changelists, store } = useDemo();
  const [change, setChange] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewData | null>(null);

  useEffect(() => {
    if (change === null) {
      setReview(null);
      return;
    }
    void store.review(change).then(setReview);
  }, [change, store]);

  return (
    <div>
      <h3>Changelist review</h3>
      <select aria-label="pick changelist" value={change ?? ""} onChange={(e) => setChange(e.target.value || null)}>
        <option value="">— pick a changelist —</option>
        {changelists.map((cl) => (
          <option key={cl.change} value={cl.change}>{cl.change} — {cl.description}</option>
        ))}
      </select>
      {review && (
        <div>
          <p>Change {review.change} by {review.user ?? "unknown"} — {review.description}</p>
          {review.files.map((file) => (
            <div key={file.depotFile}>
              <h4>{file.action} {file.depotFile}</h4>
              <DiffView rows={file.rows} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
