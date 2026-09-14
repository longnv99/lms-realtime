export interface CsvFile {
  fileName: string;
  content: string;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  return [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');
}

function escapeCsvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}
