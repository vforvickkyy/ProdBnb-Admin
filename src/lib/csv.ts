/**
 * CSV export for any paginated admin list. Pages through the same API the table uses (so an export
 * can never show something the list couldn't), up to `maxRows`, and hands the browser a file.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Neutralise spreadsheet formula injection: a cell starting with = + - @ is read as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(","));
  return [header, ...body].join("\r\n");
}

export async function collectAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ data: T[]; meta: { total: number } }>,
  maxRows = 5000
): Promise<{ rows: T[]; truncated: boolean }> {
  const pageSize = 100;
  const rows: T[] = [];
  let page = 1;
  let total = Infinity;
  while (rows.length < Math.min(total, maxRows)) {
    const result = await fetchPage(page, pageSize);
    total = result.meta.total;
    rows.push(...result.data);
    if (result.data.length < pageSize) break;
    page += 1;
  }
  return { rows: rows.slice(0, maxRows), truncated: total > maxRows };
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
