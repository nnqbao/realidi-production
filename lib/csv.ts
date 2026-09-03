export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cur);
      cur = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

export function csvHeaderIndex(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((cell, i) => {
    map[cell.trim().toLowerCase().replace(/\s+/g, "_")] = i;
  });
  return map;
}
