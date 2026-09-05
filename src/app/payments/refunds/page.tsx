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

type AdminRefundDetail = components["schemas"]["AdminRefundDetail"];

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["pending", "success", "failed", "cancelled"] as const;

function formatAmount(minorUnits: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(minorUnits / 100);
}

export default function RefundsPage() {
  return (
    <Suspense fallback={<AdminShell><TableSkeleton columns={5} /></AdminShell>}>
      <RefundsPageInner />
    </Suspense>
  );
}

function RefundsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = Number(searchParams.get("page") ?? "1");
  const status = searchParams.get("status") ?? "";

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`/payments/refunds?${params.toString()}`);
  }

  const listKey = `/v1/admin/refunds?page=${page}&status=${status}`;
  const fetcher = useCallback(
    () => adminApi.GET("/refunds", { params: { query: { page, pageSize: PAGE_SIZE, status: (status || undefined) as never } } }).then(unwrapPaginated),
    [page, status]
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<AdminRefundDetail>(listKey, fetcher);

  const columns: Column<AdminRefundDetail>[] = useMemo(
    () => [
      {
        key: "payment",
        header: "Payment",
        render: (r) => (
          <Link href={`/payments/${r.payment_id}`} className="text-slate-700 underline hover:text-slate-900">
            {r.payment?.booking?.location?.title ?? r.payment_id}
          </Link>
        ),
      },
      { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      { key: "amount", header: "Amount", render: (r) => formatAmount(r.amount_minor_units) },
      { key: "reason", header: "Reason", className: "text-slate-500", render: (r) => r.reason ?? "—" },
      { key: "created", header: "Created", render: (r) => new Date(r.created_at).toLocaleString() },
    ],
    []
  );

  return (
    <AdminShell>
      <Link href="/payments" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Back to payments
      </Link>
      <h1 className="mb-6 text-xl font-semibold">Refunds</h1>

      <div className="mb-4">
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
      </div>

      {isLoading && !meta ? (
        <TableSkeleton columns={5} />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load refunds.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="No refunds match these filters." />
      ) : (
        <>
          <Table columns={columns} rows={rows} rowKey={(r) => r.id} caption="Refunds" />
          {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => updateParams({ page: String(p) })} />}
        </>
      )}
    </AdminShell>
  );
}
