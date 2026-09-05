"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useSWR from "swr";
import { AdminShell } from "@/components/AdminShell";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Column, Table } from "@/components/ui/Table";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type AdminUserDetail = components["schemas"]["AdminUserDetail"];
type LocationDetail = components["schemas"]["LocationDetail"];
type BookingDetail = components["schemas"]["BookingDetail"];
type AuditLogEntry = components["schemas"]["AuditLogEntry"];

const SUB_PAGE_SIZE = 5;
// Bounded the same way the existing Moderation Queue already is (Phase 14) --
// a single host's own location count is expected to stay well under the
// backend's own page-size ceiling, so one fetch is treated as the complete
// set for the on-page status breakdown rather than adding a new endpoint.
const BREAKDOWN_PAGE_SIZE = 100;

function displayName(u: { first_name: string | null; last_name: string | null }): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return name || "(no name set)";
}

function initials(u: { first_name: string | null; last_name: string | null }): string {
  const first = u.first_name?.[0] ?? "";
  const last = u.last_name?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

export default function HostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [confirmAction, setConfirmAction] = useState<"suspend" | "restore" | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: host, error, isLoading, mutate } = useSWR(`/v1/admin/users/${id}`, () =>
    adminApi.GET("/users/{id}", { params: { path: { id } } }).then(unwrap<AdminUserDetail>)
  );

  // Fetches this host's full location set (bounded, see BREAKDOWN_PAGE_SIZE
  // above) once, and both the status breakdown strip and the Locations
  // table below render from this single result -- no second endpoint.
  const breakdownFetcher = useCallback(
    () => adminApi.GET("/locations", { params: { query: { host_id: id, page: 1, pageSize: BREAKDOWN_PAGE_SIZE } } }).then(unwrapPaginated<LocationDetail>),
    [id]
  );
  const { data: allLocations } = useSWR(`/v1/admin/locations?host_id=${id}&breakdown`, breakdownFetcher);

  const statusBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of allLocations?.data ?? []) {
      counts.set(l.status, (counts.get(l.status) ?? 0) + 1);
    }
    return Array.from(counts.entries());
  }, [allLocations]);

  const [locPage, setLocPage] = useState(1);
  const locationsFetcher = useCallback(
    () => adminApi.GET("/locations", { params: { query: { host_id: id, page: locPage, pageSize: SUB_PAGE_SIZE } } }).then(unwrapPaginated<LocationDetail>),
    [id, locPage]
  );
  const locations = useAdminList<LocationDetail>(`/v1/admin/locations?host_id=${id}&page=${locPage}`, locationsFetcher);

  const [hostedPage, setHostedPage] = useState(1);
  const hostedFetcher = useCallback(
    () => adminApi.GET("/bookings", { params: { query: { host_id: id, page: hostedPage, pageSize: SUB_PAGE_SIZE } } }).then(unwrapPaginated<BookingDetail>),
    [id, hostedPage]
  );
  const hostedBookings = useAdminList<BookingDetail>(`/v1/admin/bookings?host_id=${id}&page=${hostedPage}`, hostedFetcher);

  const [bookedPage, setBookedPage] = useState(1);
  const bookedFetcher = useCallback(
    () => adminApi.GET("/bookings", { params: { query: { booker_id: id, page: bookedPage, pageSize: SUB_PAGE_SIZE } } }).then(unwrapPaginated<BookingDetail>),
    [id, bookedPage]
  );
  const bookedBookings = useAdminList<BookingDetail>(`/v1/admin/bookings?booker_id=${id}&page=${bookedPage}`, bookedFetcher);

  const [auditPage, setAuditPage] = useState(1);
  const auditFetcher = useCallback(
    () =>
      adminApi
        .GET("/audit-log", { params: { query: { target_type: "user", target_id: id, page: auditPage, pageSize: SUB_PAGE_SIZE } } })
        .then(unwrapPaginated<AuditLogEntry>),
    [id, auditPage]
  );
  const auditLog = useAdminList<AuditLogEntry>(`/v1/admin/audit-log?target_type=user&target_id=${id}&page=${auditPage}`, auditFetcher);

  async function handleConfirm(reason?: string) {
    if (!confirmAction || !host) return;
    setBusy(true);
    try {
      if (confirmAction === "suspend") {
        await adminApi.POST("/users/{id}/suspend", { params: { path: { id } }, body: { reason: reason! } }).then(unwrap);
        toast.success(`${displayName(host)} suspended.`);
      } else {
        await adminApi.POST("/users/{id}/restore", { params: { path: { id } }, body: {} }).then(unwrap);
        toast.success(`${displayName(host)} restored.`);
      }
      setConfirmAction(null);
      await mutate();
      await locations.refresh();
      await auditLog.refresh();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Action failed."));
    } finally {
      setBusy(false);
    }
  }

  const locationColumns: Column<LocationDetail>[] = [
    { key: "title", header: "Title", render: (l) => l.title },
    { key: "city", header: "City", render: (l) => `${l.city}, ${l.country}` },
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
    {
      key: "view",
      header: "",
      render: (l) => (
        <Link href={`/locations/${l.id}`} className="text-sm underline hover:text-slate-900">
          View
        </Link>
      ),
    },
  ];

  const bookingColumns: Column<BookingDetail>[] = [
    { key: "location", header: "Location", render: (b) => b.location.title },
    { key: "status", header: "Status", render: (b) => <StatusBadge status={b.status} /> },
    { key: "start", header: "Start", render: (b) => new Date(b.start_at).toLocaleString() },
    {
      key: "view",
      header: "",
      render: (b) => (
        <Link href={`/bookings/${b.id}`} className="text-sm underline hover:text-slate-900">
          View
        </Link>
      ),
    },
  ];

  return (
    <AdminShell>
      <Link href="/hosts" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Back to hosts
      </Link>

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error || !host ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load this host.")} onRetry={() => mutate()} />
      ) : (
        <>
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-4">
              {host.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={host.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                  {initials(host)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="break-words text-xl font-semibold">{displayName(host)}</h1>
                <p className="break-words text-sm text-slate-500">{host.email ?? "No email on file"}</p>
              </div>
            </div>
            <StatusBadge status={host.status} />
          </div>

          <section className="mb-6 rounded border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Location status breakdown</h2>
            {statusBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400">No location data available.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {statusBreakdown.map(([status, count]) => (
                  <span key={status} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    <StatusBadge status={status} />
                    {count}
                  </span>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-6 sm:grid-cols-2">
            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Profile</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Roles</dt>
                  <dd className="flex flex-wrap justify-end gap-1">
                    {host.roles.map((r) => (
                      <StatusBadge key={r} status={r} />
                    ))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Joined</dt>
                  <dd>{new Date(host.created_at).toLocaleDateString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Last sign-in</dt>
                  <dd>{host.last_sign_in_at ? new Date(host.last_sign_in_at).toLocaleString() : "Never signed in"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Bookings hosted</dt>
                  <dd>{hostedBookings.meta ? hostedBookings.meta.total : "—"}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Administrative actions</h2>
              {host.status === "suspended" ? (
                <button
                  type="button"
                  onClick={() => setConfirmAction("restore")}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmAction("suspend")}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Suspend
                </button>
              )}
            </section>

            <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Locations</h2>
              {locations.isLoading && !locations.meta ? (
                <TableSkeleton columns={4} rows={3} />
              ) : locations.error ? (
                <ErrorState message={extractErrorMessage(locations.error, "Failed to load locations.")} onRetry={locations.refresh} />
              ) : locations.rows.length === 0 ? (
                <EmptyState title="This host has no locations." />
              ) : (
                <>
                  <Table columns={locationColumns} rows={locations.rows} rowKey={(l) => l.id} caption="Locations owned by this host" />
                  {locations.meta && (
                    <Pagination
                      page={locations.meta.page}
                      pageSize={locations.meta.pageSize}
                      total={locations.meta.total}
                      onPageChange={setLocPage}
                      label="Locations"
                    />
                  )}
                </>
              )}
            </section>

            <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Bookings hosted</h2>
              {hostedBookings.isLoading && !hostedBookings.meta ? (
                <TableSkeleton columns={4} rows={3} />
              ) : hostedBookings.error ? (
                <ErrorState message={extractErrorMessage(hostedBookings.error, "Failed to load bookings.")} onRetry={hostedBookings.refresh} />
              ) : hostedBookings.rows.length === 0 ? (
                <EmptyState title="No bookings at this host's locations." />
              ) : (
                <>
                  <Table columns={bookingColumns} rows={hostedBookings.rows} rowKey={(b) => b.id} caption="Bookings at this host's locations" />
                  {hostedBookings.meta && (
                    <Pagination
                      page={hostedBookings.meta.page}
                      pageSize={hostedBookings.meta.pageSize}
                      total={hostedBookings.meta.total}
                      onPageChange={setHostedPage}
                      label="Bookings hosted"
                    />
                  )}
                </>
              )}
            </section>

            <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Bookings made</h2>
              {bookedBookings.isLoading && !bookedBookings.meta ? (
                <TableSkeleton columns={4} rows={3} />
              ) : bookedBookings.error ? (
                <ErrorState message={extractErrorMessage(bookedBookings.error, "Failed to load bookings.")} onRetry={bookedBookings.refresh} />
              ) : bookedBookings.rows.length === 0 ? (
                <EmptyState title="This host has not made any bookings." />
              ) : (
                <>
                  <Table columns={bookingColumns} rows={bookedBookings.rows} rowKey={(b) => b.id} caption="Bookings made by this host" />
                  {bookedBookings.meta && (
                    <Pagination
                      page={bookedBookings.meta.page}
                      pageSize={bookedBookings.meta.pageSize}
                      total={bookedBookings.meta.total}
                      onPageChange={setBookedPage}
                      label="Bookings made"
                    />
                  )}
                </>
              )}
            </section>

            <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Audit history</h2>
              {auditLog.isLoading && !auditLog.meta ? (
                <TableSkeleton columns={3} rows={3} />
              ) : auditLog.error ? (
                <ErrorState message={extractErrorMessage(auditLog.error, "Failed to load audit history.")} onRetry={auditLog.refresh} />
              ) : auditLog.rows.length === 0 ? (
                <EmptyState title="No admin actions recorded for this host." />
              ) : (
                <>
                  <ul className="space-y-2 text-sm">
                    {auditLog.rows.map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between">
                        <span>
                          {entry.action.replace(/_/g, " ").toLowerCase()}
                          {entry.reason && ` — ${entry.reason}`}
                        </span>
                        <span className="text-slate-400">{new Date(entry.created_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  {auditLog.meta && (
                    <Pagination
                      page={auditLog.meta.page}
                      pageSize={auditLog.meta.pageSize}
                      total={auditLog.meta.total}
                      onPageChange={setAuditPage}
                      label="Audit history"
                    />
                  )}
                </>
              )}
            </section>
          </div>

          <ConfirmDialog
            open={confirmAction !== null}
            onOpenChange={(open) => !open && setConfirmAction(null)}
            title={confirmAction === "suspend" ? "Suspend host" : "Restore host"}
            description={
              confirmAction === "suspend"
                ? `This also suspends every published location ${displayName(host)} owns.`
                : "This republishes only locations this host's own suspension put down."
            }
            requireReason={confirmAction === "suspend"}
            confirmLabel={confirmAction === "suspend" ? "Suspend" : "Restore"}
            danger={confirmAction === "suspend"}
            busy={busy}
            onConfirm={handleConfirm}
          />
        </>
      )}
    </AdminShell>
  );
}
