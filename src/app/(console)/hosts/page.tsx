"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/Badge";
import { Column, Table } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrapPaginated } from "@/lib/api";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type AdminUserDetail = components["schemas"]["AdminUserDetail"];

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["active", "suspended", "deleted"] as const;

function displayName(u: AdminUserDetail): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return name || "(no name set)";
}

export default function HostsPage() {
  return (
    <Suspense fallback={<><TableSkeleton columns={4} /></>}>
      <HostsPageInner />
    </Suspense>
  );
}

function HostsPageInner() {
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
    router.push(`/hosts?${params.toString()}`);
  }

  // `role` is permanently pinned to "host" -- this page is a dedicated
  // resource view, not a generic Users list with a filter left open for the
  // caller to change (there is deliberately no role selector in the UI).
  const listKey = `/v1/admin/users?page=${page}&search=${search}&role=host&status=${status}`;
  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/users", {
          params: {
            query: {
              page,
              pageSize: PAGE_SIZE,
              search: search || undefined,
              role: "host",
              status: (status || undefined) as never,
            },
          },
        })
        .then(unwrapPaginated),
    [page, search, status]
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<AdminUserDetail>(listKey, fetcher);

  const columns: Column<AdminUserDetail>[] = useMemo(
    () => [
      { key: "name", header: "Name", render: (u) => <span className="font-medium text-slate-900">{displayName(u)}</span> },
      { key: "status", header: "Status", render: (u) => <StatusBadge status={u.status} /> },
      {
        key: "roles",
        header: "Roles",
        render: (u) => (
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <StatusBadge key={r} status={r} />
            ))}
          </div>
        ),
      },
      { key: "joined", header: "Joined", render: (u) => new Date(u.created_at).toLocaleDateString() },
      {
        key: "view",
        header: "",
        render: (u) => (
          <Link href={`/hosts/${u.id}`} className="text-sm font-medium text-slate-700 underline hover:text-slate-900">
            View
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Hosts</h1>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput label="Search hosts by name" value={search} onChange={(v) => updateParams({ search: v || undefined })} placeholder="Search by name…" />
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
      </div>

      {isLoading && !meta ? (
        <TableSkeleton columns={4} />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load hosts.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="No hosts match these filters." description="Try clearing the search or status filter above." />
      ) : (
        <>
          <Table columns={columns} rows={rows} rowKey={(u) => u.id} caption="Hosts" />
          {meta && (
            <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => updateParams({ page: String(p) })} label="Hosts" />
          )}
        </>
      )}
    </>
  );
}
