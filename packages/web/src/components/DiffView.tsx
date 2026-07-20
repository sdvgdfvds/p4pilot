import type { DiffRow } from "../diff.js";

export function DiffView({ rows }: { rows: DiffRow[] }) {
  if (rows.length === 0) return <p>(no diff available)</p>;
  const prefix = { add: "+", del: "-", ctx: " " } as const;
  return (
    <div
      className="diff"
      data-testid="diff"
      role="table"
      aria-label="Unified diff"
    >
      {rows.map((row, i) => (
        <div
          key={`${row.type}:${i}:${row.text}`}
          className={`diff-row ${row.type}`}
          role="row"
        >
          <span className="diff-line" aria-hidden="true">
            {i + 1}
          </span>
          <code>
            {prefix[row.type]} {row.text}
          </code>
        </div>
      ))}
    </div>
  );
}
