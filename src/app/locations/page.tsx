"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Column, Table } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type LocationDetail = components["schemas"]["LocationDetail"];
type Action = "approve" | "reject" | "suspend" | "restore";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["draft", "submitted", "under_review", "published", "rejected", "suspended", "archived"] as const;
const MODERATABLE = new Set(["submitted", "under_review", "published", "suspended"]);

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

  const [confirmTarget, setConfirmTarget] = useState<{ location: LocationDetail; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);

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
        key: "actions",
        header: "Actions",
        render: (l) =>
          !MODERATABLE.has(l.status) ? (
            <span className="text-slate-400">—</span>
          ) : (
            <div className="flex gap-2">
              {(l.status === "submitted" || l.status === "under_review") && (
                <>
                  <ActionButton onClick={() => setConfirmTarget({ location: l, action: "approve" })} label="Approve" />
                  <ActionButton onClick={() => setConfirmTarget({ location: l, action: "reject" })} label="Reject" danger />
                </>
              )}
              {l.status === "published" && <ActionButton onClick={() => setConfirmTarget({ location: l, action: "suspend" })} label="Suspend" danger />}
              {l.status === "suspended" && <ActionButton onClick={() => setConfirmTarget({ location: l, action: "restore" })} label="Restore" />}
            </div>
          ),
      },
    ],
    []
  );

  async function handleConfirm(reason?: string) {
    if (!confirmTarget) return;
    const { location, action } = confirmTarget;
    setBusy(true);
    try {
      if (action === "approve") {
        await adminApi.POST("/locations/{id}/approve", { params: { path: { id: location.id } }, body: {} }).then(unwrap);
      } else if (action === "restore") {
        await adminApi.POST("/locations/{id}/restore", { params: { path: { id: location.id } }, body: {} }).then(unwrap);
      } else if (action === "reject") {
        await adminApi.POST("/locations/{id}/reject", { params: { path: { id: location.id } }, body: { reason: reason! } }).then(unwrap);
      } else {
        await adminApi.POST("/locations/{id}/suspend", { params: { path: { id: location.id } }, body: { reason: reason! } }).then(unwrap);
      }
      toast.success(`"${location.title}" ${action === "approve" ? "approved" : action === "restore" ? "restored" : action + "ed"}.`);
      setConfirmTarget(null);
      await refresh();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Action failed."));
    } finally {
      setBusy(false);
    }
  }

  const actionCopy: Record<Action, { title: string; requireReason: boolean; danger: boolean; label: string }> = {
    approve: { title: "Approve location", requireReason: false, danger: false, label: "Approve" },
    reject: { title: "Reject location", requireReason: true, danger: true, label: "Reject" },
    suspend: { title: "Suspend location", requireReason: true, danger: true, label: "Suspend" },
    restore: { title: "Restore location", requireReason: false, danger: false, label: "Restore" },
  };

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

      {confirmTarget && (
        <ConfirmDialog
          open={confirmTarget !== null}
          onOpenChange={(open) => !open && setConfirmTarget(null)}
          title={actionCopy[confirmTarget.action].title}
          description={`"${confirmTarget.location.title}"`}
          requireReason={actionCopy[confirmTarget.action].requireReason}
          confirmLabel={actionCopy[confirmTarget.action].label}
          danger={actionCopy[confirmTarget.action].danger}
          busy={busy}
          onConfirm={handleConfirm}
        />
      )}
    </AdminShell>
  );
}

function ActionButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        danger
          ? "rounded border border-slate-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          : "rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
      }
    >
      {label}
    </button>
  );
}
