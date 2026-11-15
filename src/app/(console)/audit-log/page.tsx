"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { Badge } from "@/components/ui/Badge";
import { Column, Table } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { CsvExportButton } from "@/components/ui/CsvExportButton";
import { adminApi, unwrapPaginated } from "@/lib/api";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type AuditLogEntry = components["schemas"]["AuditLogEntry"];

const PAGE_SIZE = 20;
const ACTION_OPTIONS = [
  "ADMIN_APPROVED_LOCATION",
  "ADMIN_REJECTED_LOCATION",
  "ADMIN_SUSPENDED_LOCATION",
  "ADMIN_RESTORED_LOCATION",
  "ADMIN_UPDATED_LOCATION_STATUS",
  "ADMIN_UPDATED_LOCATION",
  "ADMIN_DELETED_MEDIA",
  "ADMIN_DELETED_SECTION",
  "ADMIN_SUSPENDED_USER",
  "ADMIN_RESTORED_USER",
  "ADMIN_GRANTED_ROLE",
  "ADMIN_REVOKED_ROLE",
  "ADMIN_CANCELLED_BOOKING",
  "ADMIN_CONFIRMED_BOOKING",
  "ADMIN_REJECTED_BOOKING",
  "ADMIN_COMPLETED_BOOKING",
  "ADMIN_CREATED_REFUND",
  "ADMIN_VERIFIED_PAYMENT",
  "ADMIN_CREATED_CATALOG_ITEM",
  "ADMIN_UPDATED_CATALOG_ITEM",
  "ADMIN_DELETED_CATALOG_ITEM",
  "ADMIN_SET_TEAM_ROLE",
  "ADMIN_REMOVED_TEAM_MEMBER",
  "ADMIN_UPDATED_SETTINGS",
] as const satisfies readonly AuditLogEntry["action"][];

const TARGET_TYPE_OPTIONS = ["location", "user", "booking", "payment", "media", "section", "catalog_item", "settings"] as const;

const ACTION_TONE: Record<string, "success" | "danger" | "warning" | "info"> = {
  ADMIN_APPROVED_LOCATION: "success",
  ADMIN_RESTORED_LOCATION: "success",
  ADMIN_RESTORED_USER: "success",
  ADMIN_REJECTED_LOCATION: "danger",
  ADMIN_SUSPENDED_LOCATION: "danger",
  ADMIN_SUSPENDED_USER: "danger",
  ADMIN_CANCELLED_BOOKING: "danger",
  ADMIN_CREATED_REFUND: "warning",
  ADMIN_UPDATED_LOCATION_STATUS: "info",
  ADMIN_UPDATED_LOCATION: "info",
  ADMIN_DELETED_MEDIA: "danger",
  ADMIN_DELETED_SECTION: "danger",
  ADMIN_GRANTED_ROLE: "info",
  ADMIN_REVOKED_ROLE: "warning",
  ADMIN_CONFIRMED_BOOKING: "success",
  ADMIN_REJECTED_BOOKING: "danger",
  ADMIN_COMPLETED_BOOKING: "success",
  ADMIN_VERIFIED_PAYMENT: "info",
  ADMIN_CREATED_CATALOG_ITEM: "info",
  ADMIN_UPDATED_CATALOG_ITEM: "info",
  ADMIN_DELETED_CATALOG_ITEM: "warning",
  ADMIN_SET_TEAM_ROLE: "warning",
  ADMIN_REMOVED_TEAM_MEMBER: "danger",
  ADMIN_UPDATED_SETTINGS: "warning",
};

export default function AuditLogPage() {
  return (
    <Suspense fallback={<><TableSkeleton columns={5} /></>}>
      <AuditLogPageInner />
    </Suspense>
  );
}

function AuditLogPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);

  const page = Number(searchParams.get("page") ?? "1");
  const action = searchParams.get("action") ?? "";
  const targetType = searchParams.get("target_type") ?? "";
  const createdAfter = searchParams.get("created_after") ?? "";
  const createdBefore = searchParams.get("created_before") ?? "";

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`/audit-log?${params.toString()}`);
  }

  const listKey = `/v1/admin/audit-log?page=${page}&action=${action}&target_type=${targetType}&created_after=${createdAfter}&created_before=${createdBefore}`;
  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/audit-log", {
          params: {
            query: {
              page,
              pageSize: PAGE_SIZE,
              action: (action || undefined) as never,
              target_type: (targetType || undefined) as never,
              created_after: createdAfter ? new Date(createdAfter).toISOString() : undefined,
              created_before: createdBefore ? new Date(createdBefore).toISOString() : undefined,
            },
          },
        })
        .then(unwrapPaginated),
    [page, action, targetType, createdAfter, createdBefore]
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<AuditLogEntry>(listKey, fetcher);

  const targetHref = useCallback((entry: AuditLogEntry): string | null => {
    if (entry.target_type === "booking") return `/bookings/${entry.target_id}`;
    if (entry.target_type === "payment") return `/payments/${entry.target_id}`;
    if (entry.target_type === "location") return `/locations/${entry.target_id}`;
    if (entry.target_type === "user") return `/users/${entry.target_id}`;
    if (entry.target_type === "catalog_item") return "/catalog";
    if (entry.target_type === "settings") return "/settings";
    // A removed photo/section no longer exists; its listing is in the metadata.
    const locationId = (entry.metadata as { location_id?: unknown }).location_id;
    if ((entry.target_type === "media" || entry.target_type === "section") && typeof locationId === "string") return `/locations/${locationId}`;
    return null;
  }, []);

  const columns: Column<AuditLogEntry>[] = useMemo(
    () => [
      { key: "when", header: "When", render: (e) => new Date(e.created_at).toLocaleString() },
      {
        key: "action",
        header: "Action",
        render: (e) => <Badge tone={ACTION_TONE[e.action] ?? "neutral"}>{e.action.replace(/_/g, " ").toLowerCase()}</Badge>,
      },
      {
        key: "target",
        header: "Target",
        render: (e) => {
          const href = targetHref(e);
          const label = `${e.target_type} · ${e.target_id.slice(0, 8)}…`;
          return href ? (
            <a href={href} className="text-slate-700 underline hover:text-slate-900">
              {label}
            </a>
          ) : (
            label
          );
        },
      },
      { key: "reason", header: "Reason", className: "text-slate-500", render: (e) => e.reason ?? "—" },
      {
        key: "metadata",
        header: "Metadata",
        render: (e) =>
          Object.keys(e.metadata ?? {}).length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(expanded === e.id ? null : e.id)}
              className="text-xs text-slate-600 underline hover:text-slate-900"
            >
              {expanded === e.id ? "Hide" : "Show"}
            </button>
          ),
      },
    ],
    [expanded, targetHref]
  );

  return (
    <>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <CsvExportButton<AuditLogEntry>
          filename="audit-log"
          fetchPage={(p, size) =>
            adminApi
              .GET("/audit-log", {
                params: {
                  query: {
                    page: p,
                    pageSize: size,
                    action: (action || undefined) as never,
                    target_type: (targetType || undefined) as never,
                    created_after: createdAfter ? new Date(createdAfter).toISOString() : undefined,
                    created_before: createdBefore ? new Date(createdBefore).toISOString() : undefined,
                  },
                },
              })
              .then(unwrapPaginated<AuditLogEntry>)
          }
          columns={[
            { header: "When", value: (e) => e.created_at },
            { header: "Admin ID", value: (e) => e.admin_id },
            { header: "Action", value: (e) => e.action },
            { header: "Target type", value: (e) => e.target_type },
            { header: "Target ID", value: (e) => e.target_id },
            { header: "Reason", value: (e) => e.reason },
            { header: "Metadata", value: (e) => JSON.stringify(e.metadata) },
          ]}
        />
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Every admin action, permanently. Reads of private conversations are logged separately in{" "}
        <a href="/conversations?view=log" className="underline">
          Disputes &amp; Messages → Access log
        </a>
        .
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <select
          aria-label="Filter by action"
          value={action}
          onChange={(e) => updateParams({ action: e.target.value || undefined })}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-card transition-colors hover:border-slate-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by target type"
          value={targetType}
          onChange={(e) => updateParams({ target_type: e.target.value || undefined })}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-card transition-colors hover:border-slate-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
        >
          <option value="">All target types</option>
          {TARGET_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          After
          <input
            type="date"
            value={createdAfter}
            onChange={(e) => updateParams({ created_after: e.target.value || undefined })}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-card transition-colors hover:border-slate-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          Before
          <input
            type="date"
            value={createdBefore}
            onChange={(e) => updateParams({ created_before: e.target.value || undefined })}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 shadow-card transition-colors hover:border-slate-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/25"
          />
        </label>
      </div>

      {isLoading && !meta ? (
        <TableSkeleton columns={5} />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load the audit log.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="No audit entries match these filters." />
      ) : (
        <>
          <Table columns={columns} rows={rows} rowKey={(e) => e.id} caption="Audit log" />
          {expanded && (
            <pre className="mt-2 overflow-x-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs">
              {JSON.stringify(rows.find((r) => r.id === expanded)?.metadata, null, 2)}
            </pre>
          )}
          {meta && (
            <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => updateParams({ page: String(p) })} label="Audit log" />
          )}
        </>
      )}
    </>
  );
}
