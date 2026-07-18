import { diffLines } from "diff";

export interface DiffRow {
  type: "add" | "del" | "ctx";
  text: string;
}

export function toDiffRows(before: string, after: string): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const part of diffLines(before, after)) {
    const type: DiffRow["type"] = part.added ? "add" : part.removed ? "del" : "ctx";
    const lines = part.value.split("\n");
    if (lines.at(-1) === "") lines.pop(); // drop only the trailing split artifact
    for (const line of lines) rows.push({ type, text: line });
  }
  return rows;
}
