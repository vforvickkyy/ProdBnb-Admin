"use client";

import { useState } from "react";
import { toast } from "sonner";
import { collectAllPages, CsvColumn, downloadCsv, toCsv } from "@/lib/csv";
import { extractErrorMessage } from "./ErrorState";
import { Button } from "./Button";

/** Exports every row matching the page's current filters (up to 5,000) as CSV. */
export function CsvExportButton<T>({
  filename,
  columns,
  fetchPage,
}: {
  filename: string;
  columns: CsvColumn<T>[];
  fetchPage: (page: number, pageSize: number) => Promise<{ data: T[]; meta: { total: number } }>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const { rows, truncated } = await collectAllPages(fetchPage);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`${filename}-${stamp}.csv`, toCsv(rows, columns));
      toast.success(`Exported ${rows.length.toLocaleString("en-IN")} rows${truncated ? " (first 5,000 only — narrow the filters for the rest)" : ""}.`);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Export failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" onClick={handleExport} disabled={busy}>
      {busy ? "Exporting…" : "Export CSV"}
    </Button>
  );
}
