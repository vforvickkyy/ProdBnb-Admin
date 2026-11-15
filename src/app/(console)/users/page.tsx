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
import { CsvExportButton } from "@/components/ui/CsvExportButton";
import { adminApi, unwrapPaginated } from "@/lib/api";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type AdminUserDetail = components["schemas"]["AdminUserDetail"];

const PAGE_SIZE = 20;
const ROLE_OPTIONS = ["booker", "host", "admin"] as const;
const STATUS_OPTIONS = ["active", "suspended", "deleted"] as const;

function displayName(u: AdminUserDetail): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return name || "(no name set)";
}

export default function UsersPage() {
  return (
    <Suspense fallback={<><TableSkeleton columns={5} /></>}>
      <UsersPageInner />
    </Suspense>
  );
}

function UsersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "";
  const status = searchParams.get("status") ?? "";

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`/users?${params.toString()}`);
  }

  const listKey = `/v1/admin/users?page=${page}&search=${search}&role=${role}&status=${status}`;
  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/users", {
          params: {
            query: {
              page,
              pageSize: PAGE_SIZE,
              search: search || undefined,
              role: (role || undefined) as never,
              status: (status || undefined) as never,
            },
          },
        })
        .then(unwrapPaginated),
    [page, search, role, status]
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<AdminUserDetail>(listKey, fetcher);

  const columns: Column<AdminUserDetail>[] = useMemo(
    () => [
      { key: "name", header: "Name", render: (u) => <span className="font-medium text-slate-900">{displayName(u)}</span> },
      {
        key: "roles",
        header: "Roles",
        render: (u) => (
          <div className="flex flex-wrap gap-1">
            {u.roles.length === 0 ? <span className="text-slate-400">none</span> : u.roles.map((r) => <StatusBadge key={r} status={r} />)}
          </div>
        ),
      },
      { key: "status", header: "Status", render: (u) => <StatusBadge status={u.status} /> },
      { key: "joined", header: "Joined", render: (u) => new Date(u.created_at).toLocaleDateString() },
      {
        key: "view",
        header: "",
        render: (u) => (
          <Link href={`/users/${u.id}`} className="text-sm font-medium text-slate-700 underline hover:text-slate-900">
            View
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Users</h1>
        <CsvExportButton<AdminUserDetail>
          filename="users"
          fetchPage={(p, size) =>
            adminApi
              .GET("/users", {
                params: { query: { page: p, pageSize: size, search: search || undefined, role: (role || undefined) as never, status: (status || undefined) as never } },
              })
              .then(unwrapPaginated<AdminUserDetail>)
          }
          columns={[
            { header: "User ID", value: (u) => u.id },
            { header: "First name", value: (u) => u.first_name },
            { header: "Last name", value: (u) => u.last_name },
            { header: "Roles", value: (u) => u.roles.join(" ") },
            { header: "Status", value: (u) => u.status },
            { header: "Joined", value: (u) => u.created_at },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput label="Search users by name" value={search} onChange={(v) => updateParams({ search: v || undefined })} placeholder="Search by name…" />
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(e) => updateParams({ role: e.target.value || undefined })}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-card transition-colors hover:border-slate-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
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
        <TableSkeleton columns={5} />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load users.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="No users match these filters." description="Try clearing the search or filters above." />
      ) : (
        <>
          <Table columns={columns} rows={rows} rowKey={(u) => u.id} caption="Users" />
          {meta && (
            <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => updateParams({ page: String(p) })} label="Users" />
          )}
        </>
      )}
    </>
  );
}
