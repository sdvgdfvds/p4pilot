import type { DiffRow } from "../diff.js";

export function DiffView({ rows }: { rows: DiffRow[] }) {
  if (rows.length === 0) return <p>(no diff available)</p>;
  const prefix = { add: "+", del: "-", ctx: " " } as const;
  return (
    <pre className="diff" data-testid="diff">
      {rows.map((row, i) => (
        <div key={i} className={row.type}>{prefix[row.type]} {row.text}</div>
      ))}
    </pre>
  );
}
