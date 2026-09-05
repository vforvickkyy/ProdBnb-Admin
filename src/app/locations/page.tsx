"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Column, Table } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrapPaginated } from "@/lib/api";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type LocationDetail = components["schemas"]["LocationDetail"];

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["draft", "submitted", "under_review", "published", "rejected", "suspended", "archived"] as const;

export default function LocationsPage() {
  return (
    <Suspense fallback={<AdminShell><TableSkeleton columns={5} /></AdminShell>}>
      <LocationsPageInner />
    </Suspense>
  );
}

function LocationsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`/locations?${params.toString()}`);
  }

  const listKey = `/v1/admin/locations?page=${page}&search=${search}&status=${status}`;
  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/locations", { params: { query: { page, pageSize: PAGE_SIZE, search: search || undefined, status: (status || undefined) as never } } })
        .then(unwrapPaginated),
    [page, search, status]
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<LocationDetail>(listKey, fetcher);

  const columns: Column<LocationDetail>[] = useMemo(
    () => [
      { key: "title", header: "Title", render: (l) => <span className="font-medium text-slate-900">{l.title}</span> },
      { key: "city", header: "Location", render: (l) => `${l.city}, ${l.country}` },
      {
        key: "status",
        header: "Status",
        render: (l) => (
          <div className="flex flex-col gap-1">
            <StatusBadge status={l.status} />
            {l.status === "suspended" && (
              <Badge tone="neutral">{l.suspended_by_host_suspension ? "Host account suspended" : "Policy violation"}</Badge>
            )}
          </div>
        ),
      },
      { key: "reason", header: "Reason", className: "text-slate-500", render: (l) => l.moderation_reason ?? "—" },
      {
        key: "view",
        header: "",
        render: (l) => (
          <Link href={`/locations/${l.id}`} className="text-sm font-medium text-slate-700 underline hover:text-slate-900">
            View
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-semibold">Locations</h1>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput label="Search locations by title" value={search} onChange={(v) => updateParams({ search: v || undefined })} placeholder="Search by title…" />
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
        <ErrorState message={extractErrorMessage(error, "Failed to load locations.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="No locations match these filters." description="Try clearing the search or status filter above." />
      ) : (
        <>
          <Table columns={columns} rows={rows} rowKey={(l) => l.id} caption="Locations" />
          {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => updateParams({ page: String(p) })} />}
        </>
      )}
    </AdminShell>
  );
}
