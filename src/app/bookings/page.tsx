"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Column, Table } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrapPaginated } from "@/lib/api";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type BookingDetail = components["schemas"]["BookingDetail"];

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["requested", "confirmed", "cancelled", "completed", "rejected"] as const;

function name(n: { first_name: string | null; last_name: string | null } | null | undefined): string {
  if (!n) return "—";
  return [n.first_name, n.last_name].filter(Boolean).join(" ") || "(no name)";
}

function latestPaymentStatus(b: BookingDetail): string | null {
  if (!b.payments || b.payments.length === 0) return null;
  return [...b.payments].sort((a, c) => new Date(c.created_at).getTime() - new Date(a.created_at).getTime())[0]!.status;
}

function formatAmount(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(minorUnits / 100);
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<AdminShell><TableSkeleton columns={7} /></AdminShell>}>
      <BookingsPageInner />
    </Suspense>
  );
}

function BookingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const status = searchParams.get("status") ?? "";
  const startAfter = searchParams.get("start_after") ?? "";
  const startBefore = searchParams.get("start_before") ?? "";

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`/bookings?${params.toString()}`);
  }

  const listKey = `/v1/admin/bookings?page=${page}&status=${status}&start_after=${startAfter}&start_before=${startBefore}`;
  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/bookings", {
          params: {
            query: {
              page,
              pageSize: PAGE_SIZE,
              status: (status || undefined) as never,
              start_after: startAfter ? new Date(startAfter).toISOString() : undefined,
              start_before: startBefore ? new Date(startBefore).toISOString() : undefined,
            },
          },
        })
        .then(unwrapPaginated),
    [page, status, startAfter, startBefore]
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<BookingDetail>(listKey, fetcher);

  const columns: Column<BookingDetail>[] = useMemo(
    () => [
      { key: "location", header: "Location", render: (b) => <span className="font-medium text-slate-900">{b.location.title}</span> },
      { key: "booker", header: "Booker", render: (b) => name(b.booker) },
      { key: "host", header: "Host", render: (b) => name(b.location.host) },
      { key: "type", header: "Type", render: (b) => b.booking_type.replace("_", " ") },
      { key: "start", header: "Start", render: (b) => new Date(b.start_at).toLocaleString() },
      { key: "status", header: "Status", render: (b) => <StatusBadge status={b.status} /> },
      {
        key: "payment",
        header: "Payment",
        render: (b) => {
          const s = latestPaymentStatus(b);
          return s ? <StatusBadge status={s} /> : <span className="text-slate-400">none</span>;
        },
      },
      { key: "total", header: "Total", render: (b) => formatAmount(b.pricing.total_amount_minor_units, b.pricing.currency) },
    ],
    []
  );

  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-semibold">Bookings</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => updateParams({ status: e.target.value || undefined })}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Starting after
          <input
            type="date"
            value={startAfter}
            onChange={(e) => updateParams({ start_after: e.target.value || undefined })}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Starting before
          <input
            type="date"
            value={startBefore}
            onChange={(e) => updateParams({ start_before: e.target.value || undefined })}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
      </div>

      {isLoading && !meta ? (
        <TableSkeleton columns={8} />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load bookings.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="No bookings match these filters." />
      ) : (
        <>
          <Table columns={columns} rows={rows} rowKey={(b) => b.id} onRowClick={(b) => router.push(`/bookings/${b.id}`)} caption="Bookings" />
          {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => updateParams({ page: String(p) })} />}
        </>
      )}
    </AdminShell>
  );
}
