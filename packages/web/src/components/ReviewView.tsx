import { useEffect, useState } from "react";
import { FileDiff, GitPullRequest, LoaderCircle } from "lucide-react";
import { operationKey, useDemo } from "../demo/useDemo.js";
import type { ReviewData } from "../demo/store.js";
import { DiffView } from "./DiffView.js";

export function ReviewView() {
  const { changelists, loadReview, pending } = useDemo();
  const [change, setChange] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewData | null>(null);

  useEffect(() => {
    if (change === null) {
      setReview(null);
      return;
    }
    let active = true;
    setReview(null);
    void loadReview(change).then((nextReview) => {
      if (active && nextReview !== undefined) setReview(nextReview);
    });
    return () => {
      active = false;
    };
  }, [change, loadReview]);

  return (
    <section className="review-view" aria-labelledby="review-heading">
      <div className="section-heading review-heading">
        <div>
          <h2 id="review-heading">Changelist review</h2>
          <p>Review pending work as a structured diff</p>
        </div>
        <label className="review-picker">
          <span>Pending changelist</span>
          <select
            aria-label="pick changelist"
            value={change ?? ""}
            onChange={(e) => setChange(e.target.value || null)}
          >
            <option value="">No changelist selected</option>
            {changelists.map((cl) => (
              <option key={cl.change} value={cl.change}>
                {cl.change} — {cl.description}
              </option>
            ))}
          </select>
        </label>
      </div>
      {change && pending.includes(operationKey.review(change)) && (
        <div className="loading-state">
          <LoaderCircle className="spin" size={20} />
          Loading review
        </div>
      )}
      {!change && (
        <div className="empty-state">
          <GitPullRequest size={28} />
          <strong>No changelist selected</strong>
          <span>0 files in review</span>
        </div>
      )}
      {review && (
        <div className="review-content">
          <div className="review-summary">
            <div>
              <span className="cl-number">CL {review.change}</span>
              <strong>{review.description}</strong>
            </div>
            <span>
              {review.files.length} file{review.files.length === 1 ? "" : "s"} ·{" "}
              {review.user ?? "unknown"}
            </span>
          </div>
          {review.files.map((file) => (
            <section className="diff-file" key={file.depotFile}>
              <h3>
                <FileDiff size={16} />
                <span className="file-action">{file.action}</span>
                {file.depotFile}
              </h3>
              <DiffView rows={file.rows} />
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
