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
import { adminApi, unwrapPaginated } from "@/lib/api";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type AdminPaymentDetail = components["schemas"]["AdminPaymentDetail"];

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["created", "pending", "success", "failed", "cancelled", "refunded", "partially_refunded"] as const;

function name(n: { first_name: string | null; last_name: string | null } | null | undefined): string {
  if (!n) return "—";
  return [n.first_name, n.last_name].filter(Boolean).join(" ") || "(no name)";
}

function formatAmount(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(minorUnits / 100);
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<AdminShell><TableSkeleton columns={6} /></AdminShell>}>
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

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`/payments?${params.toString()}`);
  }

  const listKey = `/v1/admin/payments?page=${page}&status=${status}&created_after=${createdAfter}&created_before=${createdBefore}`;
  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/payments", {
          params: {
            query: {
              page,
              pageSize: PAGE_SIZE,
              status: (status || undefined) as never,
              created_after: createdAfter ? new Date(createdAfter).toISOString() : undefined,
              created_before: createdBefore ? new Date(createdBefore).toISOString() : undefined,
            },
          },
        })
        .then(unwrapPaginated),
    [page, status, createdAfter, createdBefore]
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<AdminPaymentDetail>(listKey, fetcher);

  const columns: Column<AdminPaymentDetail>[] = useMemo(
    () => [
      { key: "location", header: "Location", render: (p) => p.booking?.location?.title ?? "—" },
      { key: "booker", header: "Booker", render: (p) => name(p.booking?.booker) },
      { key: "provider", header: "Provider", render: (p) => p.provider },
      { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status} /> },
      { key: "amount", header: "Amount", render: (p) => formatAmount(p.amount_minor_units, p.currency) },
      { key: "created", header: "Created", render: (p) => new Date(p.created_at).toLocaleString() },
    ],
    []
  );

  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-semibold">Payments</h1>

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
          {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => updateParams({ page: String(p) })} />}
        </>
      )}
    </AdminShell>
  );
}
