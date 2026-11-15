"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Column, Table } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { CsvExportButton } from "@/components/ui/CsvExportButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { adminApi, unwrapPaginated } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type BookingDetail = components["schemas"]["AdminBooking"];
type PaymentState = "" | "paid" | "unpaid" | "unpaid_hold";

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
    <Suspense fallback={<><TableSkeleton columns={7} /></>}>
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
  const paymentState = (searchParams.get("payment_state") ?? "") as PaymentState;

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`/bookings?${params.toString()}`);
  }

  const listKey = `/v1/admin/bookings?page=${page}&status=${status}&start_after=${startAfter}&start_before=${startBefore}&payment_state=${paymentState}`;
  const fetchPage = useCallback(
    (pageNumber: number, pageSize: number) =>
      adminApi
        .GET("/bookings", {
          params: {
            query: {
              page: pageNumber,
              pageSize,
              status: (status || undefined) as never,
              start_after: startAfter ? new Date(startAfter).toISOString() : undefined,
              start_before: startBefore ? new Date(startBefore).toISOString() : undefined,
              payment_state: paymentState || undefined,
            },
          },
        })
        .then(unwrapPaginated<BookingDetail>),
    [status, startAfter, startBefore, paymentState]
  );
  const fetcher = useCallback(() => fetchPage(page, PAGE_SIZE), [fetchPage, page]);
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
      {
        key: "hold",
        header: "Unpaid hold",
        render: (b) =>
          b.hold_expires_at ? (
            <span className={new Date(b.hold_expires_at).getTime() < Date.now() ? "text-red-700" : "text-amber-700"}>
              {new Date(b.hold_expires_at).getTime() < Date.now() ? "lapsing now" : `expires ${relativeTime(b.hold_expires_at)}`}
            </span>
          ) : b.hold_expired_at ? (
            <span className="text-slate-500">expired</span>
          ) : (
            <span className="text-slate-300">—</span>
          ),
      },
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Every booking on the platform, including ones a host cannot see because nobody has paid."
        actions={
          <CsvExportButton<BookingDetail>
            filename="bookings"
            fetchPage={fetchPage}
            columns={[
              { header: "Booking ID", value: (b) => b.id },
              { header: "Listing", value: (b) => b.location.title },
              { header: "City", value: (b) => b.location.city },
              { header: "Booker", value: (b) => name(b.booker) },
              { header: "Host", value: (b) => name(b.location.host) },
              { header: "Type", value: (b) => b.booking_type },
              { header: "Start", value: (b) => b.start_at },
              { header: "End", value: (b) => b.end_at },
              { header: "Status", value: (b) => b.status },
              { header: "Latest payment", value: (b) => latestPaymentStatus(b) },
              { header: "Base (minor)", value: (b) => b.pricing.base_amount_minor_units },
              { header: "Platform fee (minor)", value: (b) => b.pricing.platform_fee_minor_units },
              { header: "Tax (minor)", value: (b) => b.pricing.tax_minor_units },
              { header: "Total (minor)", value: (b) => b.pricing.total_amount_minor_units },
              { header: "Currency", value: (b) => b.pricing.currency },
              { header: "Created", value: (b) => b.created_at },
            ]}
          />
        }
      />

      <div className="mb-4">
        <Segmented<PaymentState>
          label="Payment"
          value={paymentState}
          options={[
            { value: "", label: "All" },
            { value: "paid", label: "Paid" },
            { value: "unpaid", label: "Unpaid" },
            { value: "unpaid_hold", label: "Unpaid holds" },
          ]}
          onChange={(v) => updateParams({ payment_state: v || undefined })}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => updateParams({ status: e.target.value || undefined })}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-card transition-colors hover:border-slate-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
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
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-card transition-colors hover:border-slate-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Starting before
          <input
            type="date"
            value={startBefore}
            onChange={(e) => updateParams({ start_before: e.target.value || undefined })}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-card transition-colors hover:border-slate-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
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
          {meta && (
            <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => updateParams({ page: String(p) })} label="Bookings" />
          )}
        </>
      )}
    </>
  );
}
