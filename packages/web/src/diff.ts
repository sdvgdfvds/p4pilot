import { diffLines } from "diff";

export interface DiffRow {
  type: "add" | "del" | "ctx";
  text: string;
}

export function toDiffRows(before: string, after: string): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const part of diffLines(before, after)) {
    const type: DiffRow["type"] = part.added ? "add" : part.removed ? "del" : "ctx";
    for (const line of part.value.split("\n")) {
      if (line.length > 0) rows.push({ type, text: line });
    }
  }
  return rows;
}
