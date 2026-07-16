export type ZtagRecord = Map<string, string>;

export function parseZtag(stdout: string): ZtagRecord[] {
  const records: ZtagRecord[] = [];
  let record: ZtagRecord = new Map();
  let previousKey: string | undefined;

  const finishRecord = (): void => {
    if (record.size > 0) {
      records.push(record);
      record = new Map();
    }
    previousKey = undefined;
  };

  for (const line of stdout.split(/\r?\n/)) {
    if (line.length === 0) {
      finishRecord();
    } else if (line.startsWith("... ")) {
      const field = line.slice(4);
      const separatorIndex = field.indexOf(" ");
      const key = separatorIndex === -1 ? field : field.slice(0, separatorIndex);
      const value = separatorIndex === -1 ? "" : field.slice(separatorIndex + 1);
      record.set(key, value);
      previousKey = key;
    } else if (previousKey !== undefined) {
      const previousValue = record.get(previousKey) ?? "";
      record.set(previousKey, `${previousValue}\n${line}`);
    }
  }

  finishRecord();
  return records;
}

export function groupIndexed(record: ZtagRecord): Record<string, string | string[]> {
  const grouped: Record<string, string | string[]> = {};
  const indexed = new Map<string, Array<{ index: number; value: string }>>();

  for (const [key, value] of record) {
    const match = /^(.*?)(\d+)$/.exec(key);
    const baseKey = match?.[1];
    const indexText = match?.[2];
    if (baseKey === undefined || indexText === undefined) {
      grouped[key] = value;
      continue;
    }

    const values = indexed.get(baseKey) ?? [];
    values.push({ index: Number(indexText), value });
    indexed.set(baseKey, values);
  }

  for (const [key, values] of indexed) {
    grouped[key] = values
      .sort((left, right) => left.index - right.index)
      .map(({ value }) => value);
  }

  return grouped;
}
