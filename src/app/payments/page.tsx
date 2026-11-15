"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
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
import { formatDateTime } from "@/lib/format";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type AdminPaymentDetail = components["schemas"]["AdminPaymentDetail"];
type Attention = components["schemas"]["PaymentNeedingAttention"];

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["created", "pending", "success", "failed", "cancelled", "refunded", "partially_refunded"] as const;

function name(n: { first_name: string | null; last_name: string | null } | null | undefined): string {
  if (!n) return "—";
  return [n.first_name, n.last_name].filter(Boolean).join(" ") || "(no name)";
}

function formatAmount(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <AdminShell>
          <TableSkeleton columns={6} />
        </AdminShell>
      }
    >
      <PaymentsPageInner />
    </Suspense>
  );
}

function PaymentsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const status = searchParams.get("status") ?? "";
  const createdAfter = searchParams.get("created_after") ?? "";
  const createdBefore = searchParams.get("created_before") ?? "";
  const view = searchParams.get("view") === "attention" ? "attention" : "all";

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`/payments?${params.toString()}`);
  }

  const listKey =
    view === "all" ? `/v1/admin/payments?page=${page}&status=${status}&created_after=${createdAfter}&created_before=${createdBefore}` : null;
  const fetchPage = useCallback(
    (pageNumber: number, pageSize: number) =>
      adminApi
        .GET("/payments", {
          params: {
            query: {
              page: pageNumber,
              pageSize,
              status: (status || undefined) as never,
              created_after: createdAfter ? new Date(createdAfter).toISOString() : undefined,
              created_before: createdBefore ? new Date(createdBefore).toISOString() : undefined,
            },
          },
        })
        .then(unwrapPaginated<AdminPaymentDetail>),
    [status, createdAfter, createdBefore],
  );
  const fetcher = useCallback(() => fetchPage(page, PAGE_SIZE), [fetchPage, page]);
  const { rows, meta, isLoading, error, refresh } = useAdminList<AdminPaymentDetail>(listKey, fetcher);

  const columns: Column<AdminPaymentDetail>[] = useMemo(
    () => [
      {
        key: "location",
        header: "Location",
        render: (p) => p.booking?.location?.title ?? "—",
      },
      {
        key: "booker",
        header: "Booker",
        render: (p) => name(p.booking?.booker),
      },
      { key: "provider", header: "Provider", render: (p) => p.provider },
      {
        key: "status",
        header: "Status",
        render: (p) => <StatusBadge status={p.status} />,
      },
      {
        key: "amount",
        header: "Amount",
        render: (p) => formatAmount(p.amount_minor_units, p.currency),
      },
      {
        key: "created",
        header: "Created",
        render: (p) => new Date(p.created_at).toLocaleString(),
      },
    ],
    [],
  );

  return (
    <AdminShell>
      <PageHeader
        title="Payments"
        description="Every payment attempt, and the money that needs a decision."
        actions={
          view === "all" && (
            <CsvExportButton<AdminPaymentDetail>
              filename="payments"
              fetchPage={fetchPage}
              columns={[
                { header: "Payment ID", value: (p) => p.id },
                { header: "Booking ID", value: (p) => p.booking_id },
                { header: "Listing", value: (p) => p.booking?.location?.title },
                { header: "Booker", value: (p) => name(p.booking?.booker) },
                { header: "Provider", value: (p) => p.provider },
                { header: "Provider order", value: (p) => p.provider_order_id },
                { header: "Status", value: (p) => p.status },
                {
                  header: "Amount (minor)",
                  value: (p) => p.amount_minor_units,
                },
                { header: "Currency", value: (p) => p.currency },
                { header: "Failure reason", value: (p) => p.failure_reason },
                { header: "Created", value: (p) => p.created_at },
              ]}
            />
          )
        }
      />

      <div className="mb-4">
        <Segmented
          label="View"
          value={view}
          options={[
            { value: "all", label: "All payments" },
            { value: "attention", label: "Needs attention" },
          ]}
          onChange={(v) => updateParams({ view: v === "attention" ? "attention" : undefined })}
        />
      </div>

      {view === "attention" ? (
        <AttentionList page={page} onPageChange={(p) => updateParams({ page: String(p) })} />
      ) : (
        <>
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
              Created after
              <input
                type="date"
                value={createdAfter}
                onChange={(e) => updateParams({ created_after: e.target.value || undefined })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              Created before
              <input
                type="date"
                value={createdBefore}
                onChange={(e) => updateParams({ created_before: e.target.value || undefined })}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <Link href="/payments/refunds" className="ml-auto text-sm text-slate-600 underline hover:text-slate-900">
              View refunds →
            </Link>
          </div>

          {isLoading && !meta ? (
            <TableSkeleton columns={6} />
          ) : error ? (
            <ErrorState message={extractErrorMessage(error, "Failed to load payments.")} onRetry={refresh} />
          ) : rows.length === 0 ? (
            <EmptyState title="No payments match these filters." />
          ) : (
            <>
              <Table columns={columns} rows={rows} rowKey={(p) => p.id} onRowClick={(p) => router.push(`/payments/${p.id}`)} caption="Payments" />
              {meta && (
                <Pagination
                  page={meta.page}
                  pageSize={meta.pageSize}
                  total={meta.total}
                  onPageChange={(p) => updateParams({ page: String(p) })}
                  label="Payments"
                />
              )}
            </>
          )}
        </>
      )}
    </AdminShell>
  );
}

/**
 * Money taken for a booking that is no longer happening (cancelled, rejected, or an unpaid hold
 * that expired before a late payment settled) and not yet fully refunded. Each row is a decision.
 */
function AttentionList({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  const router = useRouter();
  const { rows, meta, isLoading, error, refresh } = useAdminList<Attention>(`/v1/admin/payments/attention?page=${page}`, () =>
    adminApi
      .GET("/payments/attention", {
        params: { query: { page, pageSize: PAGE_SIZE } },
      })
      .then(unwrapPaginated<Attention>),
  );

  const columns: Column<Attention>[] = [
    {
      key: "location",
      header: "Listing",
      render: (p) => p.booking?.location?.title ?? "—",
    },
    { key: "booker", header: "Booker", render: (p) => name(p.booking?.booker) },
    {
      key: "why",
      header: "Booking",
      render: (p) => (
        <span>
          <StatusBadge status={p.booking_status} />
          {p.hold_expired && <span className="ml-1 text-xs text-slate-500">(hold expired)</span>}
          <span className="block text-xs text-slate-500">{formatDateTime(p.cancelled_at)}</span>
        </span>
      ),
    },
    {
      key: "paid",
      header: "Paid",
      render: (p) => formatAmount(p.amount_minor_units, p.currency),
    },
    {
      key: "refunded",
      header: "Refunded so far",
      render: (p) => formatAmount(p.refunded_minor_units, p.currency),
    },
    {
      key: "owed",
      header: "Outstanding",
      render: (p) => <strong>{formatAmount(p.amount_minor_units - p.refunded_minor_units, p.currency)}</strong>,
    },
  ];

  if (isLoading && !meta) return <TableSkeleton columns={6} />;
  if (error) return <ErrorState message={extractErrorMessage(error, "Failed to load payments needing attention.")} onRetry={refresh} />;
  if (rows.length === 0) return <EmptyState title="Nothing needs attention." description="No money is held for a booking that isn't going ahead." />;
  return (
    <>
      <p className="mb-3 text-sm text-slate-600">
        Cancelling or rejecting a booking never refunds automatically. Open a payment to refund it in full or in part.
      </p>
      <Table
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        onRowClick={(p) => router.push(`/payments/${p.id}`)}
        caption="Payments needing attention"
      />
      {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={onPageChange} label="Needs attention" />}
    </>
  );
}
