"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Column, Table } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useAdminMe } from "@/lib/useAdminMe";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import type { components } from "@/types/admin-api";

type LocationDetail = components["schemas"]["AdminLocationListItem"];
type Action = "approve" | "reject";

// The two moderation-pending statuses merged client-side, oldest first --
// not a single backend comma-list filter (a real option, decided against
// for now since two requests here is simple and this queue is meant to stay
// small; revisit if it ever doesn't). No pagination UI: if this list ever
// exceeds the API's own 100-row page cap, that's an operational problem
// bigger than this page, not something to silently paginate around.
async function fetchQueue(): Promise<LocationDetail[]> {
  const [submitted, underReview] = await Promise.all([
    adminApi.GET("/locations", { params: { query: { status: "submitted", pageSize: 100 } } }).then(unwrapPaginated),
    adminApi.GET("/locations", { params: { query: { status: "under_review", pageSize: 100 } } }).then(unwrapPaginated),
  ]);
  return [...submitted.data, ...underReview.data].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export default function ModerationPage() {
  const { data: rows, error, isLoading, mutate } = useSWR("/v1/admin/moderation-queue", fetchQueue, { revalidateOnFocus: false });
  const [confirmTarget, setConfirmTarget] = useState<{ location: LocationDetail; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);
  const { can } = useAdminMe();
  const canModerate = can("locations.moderate");

  const columns: Column<LocationDetail>[] = useMemo(
    () => [
      { key: "title", header: "Title", render: (l) => <span className="font-medium text-slate-900">{l.title}</span> },
      { key: "city", header: "Location", render: (l) => `${l.city}, ${l.country}` },
      { key: "submitted", header: "Waiting since", render: (l) => new Date(l.created_at).toLocaleString() },
      {
        key: "review",
        header: "",
        render: (l) => (
          <Link href={`/locations/${l.id}`} className="text-xs text-slate-600 underline hover:text-slate-900">
            Review details
          </Link>
        ),
      },
      ...(canModerate
        ? ([
            {
              key: "actions",
              header: "Actions",
              render: (l) => (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmTarget({ location: l, action: "approve" })}
                    className="h-7 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-card hover:bg-slate-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmTarget({ location: l, action: "reject" })}
                    className="h-7 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-medium text-red-700 shadow-card hover:bg-red-50"
                  >
                    Reject
                  </button>
                </div>
              ),
            },
          ] satisfies Column<LocationDetail>[])
        : []),
    ],
    [canModerate],
  );

  const handleConfirm = useCallback(
    async (reason?: string) => {
      if (!confirmTarget) return;
      const { location, action } = confirmTarget;
      setBusy(true);
      try {
        if (action === "approve") {
          await adminApi.POST("/locations/{id}/approve", { params: { path: { id: location.id } }, body: {} }).then(unwrap);
          toast.success(`"${location.title}" approved and published.`);
        } else {
          await adminApi.POST("/locations/{id}/reject", { params: { path: { id: location.id } }, body: { reason: reason! } }).then(unwrap);
          toast.success(`"${location.title}" rejected.`);
        }
        setConfirmTarget(null);
        await mutate();
      } catch (err) {
        toast.error(extractErrorMessage(err, "Action failed."));
      } finally {
        setBusy(false);
      }
    },
    [confirmTarget, mutate],
  );

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Moderation Queue</h1>
      <p className="mb-6 text-sm text-slate-500">Locations awaiting review, oldest first.</p>

      {isLoading ? (
        <TableSkeleton columns={4} />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load the moderation queue.")} onRetry={() => mutate()} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState title="Nothing awaiting review." description="New submissions will show up here." />
      ) : (
        <Table columns={columns} rows={rows} rowKey={(l) => l.id} caption="Locations awaiting moderation" />
      )}

      {confirmTarget && (
        <ConfirmDialog
          open={confirmTarget !== null}
          onOpenChange={(open) => !open && setConfirmTarget(null)}
          title={confirmTarget.action === "approve" ? "Approve location" : "Reject location"}
          description={`"${confirmTarget.location.title}"`}
          requireReason={confirmTarget.action === "reject"}
          confirmLabel={confirmTarget.action === "approve" ? "Approve" : "Reject"}
          danger={confirmTarget.action === "reject"}
          busy={busy}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
