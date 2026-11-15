"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useSWR from "swr";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Column, Table } from "@/components/ui/Table";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { TEAM_ROLE_LABELS, useAdminMe } from "@/lib/useAdminMe";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type AdminUserDetail = components["schemas"]["AdminUserFullDetail"];
type LocationDetail = components["schemas"]["AdminLocationListItem"];
type BookingDetail = components["schemas"]["BookingDetail"];
type AuditLogEntry = components["schemas"]["AuditLogEntry"];

const SUB_PAGE_SIZE = 5;

function displayName(u: { first_name: string | null; last_name: string | null }): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return name || "(no name set)";
}

function initials(u: { first_name: string | null; last_name: string | null }): string {
  const first = u.first_name?.[0] ?? "";
  const last = u.last_name?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [confirmAction, setConfirmAction] = useState<"suspend" | "restore" | null>(null);
  const [busy, setBusy] = useState(false);
  const { can } = useAdminMe();
  const [roleBusy, setRoleBusy] = useState(false);

  const { data: user, error, isLoading, mutate } = useSWR(`/v1/admin/users/${id}`, () =>
    adminApi.GET("/users/{id}", { params: { path: { id } } }).then(unwrap<AdminUserDetail>)
  );

  const [locPage, setLocPage] = useState(1);
  const locationsKey = user?.roles.includes("host") ? `/v1/admin/locations?host_id=${id}&page=${locPage}` : null;
  const locationsFetcher = useCallback(
    () => adminApi.GET("/locations", { params: { query: { host_id: id, page: locPage, pageSize: SUB_PAGE_SIZE } } }).then(unwrapPaginated<LocationDetail>),
    [id, locPage]
  );
  const locations = useAdminList<LocationDetail>(locationsKey, locationsFetcher);

  const [bookedPage, setBookedPage] = useState(1);
  const bookedFetcher = useCallback(
    () => adminApi.GET("/bookings", { params: { query: { booker_id: id, page: bookedPage, pageSize: SUB_PAGE_SIZE } } }).then(unwrapPaginated<BookingDetail>),
    [id, bookedPage]
  );
  const bookedBookings = useAdminList<BookingDetail>(`/v1/admin/bookings?booker_id=${id}&page=${bookedPage}`, bookedFetcher);

  const [hostedPage, setHostedPage] = useState(1);
  const hostedKey = user?.roles.includes("host") ? `/v1/admin/bookings?host_id=${id}&page=${hostedPage}` : null;
  const hostedFetcher = useCallback(
    () => adminApi.GET("/bookings", { params: { query: { host_id: id, page: hostedPage, pageSize: SUB_PAGE_SIZE } } }).then(unwrapPaginated<BookingDetail>),
    [id, hostedPage]
  );
  const hostedBookings = useAdminList<BookingDetail>(hostedKey, hostedFetcher);

  const [auditPage, setAuditPage] = useState(1);
  const auditFetcher = useCallback(
    () =>
      adminApi
        .GET("/audit-log", { params: { query: { target_type: "user", target_id: id, page: auditPage, pageSize: SUB_PAGE_SIZE } } })
        .then(unwrapPaginated<AuditLogEntry>),
    [id, auditPage]
  );
  const auditLog = useAdminList<AuditLogEntry>(`/v1/admin/audit-log?target_type=user&target_id=${id}&page=${auditPage}`, auditFetcher);

  async function toggleRole(role: "booker" | "host", grant: boolean) {
    setRoleBusy(true);
    try {
      const path = { params: { path: { id, role } } };
      if (grant) await adminApi.POST("/users/{id}/roles/{role}", path).then(unwrap);
      else await adminApi.DELETE("/users/{id}/roles/{role}", path).then(unwrap);
      toast.success(grant ? `Granted the ${role} role.` : `Removed the ${role} role.`);
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not change roles."));
    } finally {
      setRoleBusy(false);
    }
  }

  async function handleConfirm(reason?: string) {
    if (!confirmAction || !user) return;
    setBusy(true);
    try {
      if (confirmAction === "suspend") {
        await adminApi.POST("/users/{id}/suspend", { params: { path: { id } }, body: { reason: reason! } }).then(unwrap);
        toast.success(`${displayName(user)} suspended.`);
      } else {
        await adminApi.POST("/users/{id}/restore", { params: { path: { id } }, body: {} }).then(unwrap);
        toast.success(`${displayName(user)} restored.`);
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
    { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
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
    <>
      <Link href="/users" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Back to users
      </Link>

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error || !user ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load this user.")} onRetry={() => mutate()} />
      ) : (
        <>
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-4">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                  {initials(user)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="break-words text-xl font-semibold">{displayName(user)}</h1>
                <p className="break-words text-sm text-slate-500">{user.email ?? "No email on file"}</p>
              </div>
            </div>
            <StatusBadge status={user.status} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Profile</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Roles</dt>
                  <dd className="flex flex-wrap justify-end gap-1">
                    {user.roles.length === 0 ? <span className="text-slate-400">none</span> : user.roles.map((r) => <StatusBadge key={r} status={r} />)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Admin team</dt>
                  <dd>
                    {user.team_role ? (
                      <Link href="/team" className="underline hover:text-slate-900">
                        {TEAM_ROLE_LABELS[user.team_role]}
                      </Link>
                    ) : (
                      <span className="text-slate-400">not an admin</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Joined</dt>
                  <dd>{new Date(user.created_at).toLocaleDateString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Last sign-in</dt>
                  <dd>{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Never signed in"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Locations</dt>
                  <dd>{user.locations_count}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Bookings</dt>
                  <dd>{user.bookings_count}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Administrative actions</h2>
              {!can("users.manage") ? (
                <p className="text-sm text-slate-500">Your admin role can view this account but not change it.</p>
              ) : user.status === "suspended" ? (
                <button
                  type="button"
                  onClick={() => setConfirmAction("restore")}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 shadow-card transition-colors hover:bg-slate-50"
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
              {can("users.manage") && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-xs font-medium text-slate-500">Marketplace roles</p>
                  <div className="flex flex-wrap gap-2">
                    {(["booker", "host"] as const).map((role) =>
                      user.roles.includes(role) ? (
                        <Button key={role} size="sm" variant="danger" disabled={roleBusy} onClick={() => toggleRole(role, false)}>
                          Remove {role}
                        </Button>
                      ) : (
                        <Button key={role} size="sm" disabled={roleBusy} onClick={() => toggleRole(role, true)}>
                          Make {role}
                        </Button>
                      )
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Removing host keeps their listings; it only stops new ones. Admin access is managed on the Team page.</p>
                </div>
              )}
              {can("messages.access") && (
                <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-sm">
                  <Link href={`/conversations?booker_id=${id}`} className="underline hover:text-slate-900">
                    Conversations as booker
                  </Link>
                  {user.roles.includes("host") && (
                    <Link href={`/conversations?host_id=${id}`} className="underline hover:text-slate-900">
                      Conversations as host
                    </Link>
                  )}
                </div>
              )}
            </section>

            <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Contact & billing</h2>
              <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {[
                  ["Phone", user.contact?.phone ?? "—"],
                  [
                    "Address",
                    [
                      user.contact?.address_line1,
                      user.contact?.address_line2,
                      user.contact?.address_city,
                      user.contact?.address_region,
                      user.contact?.address_postal_code,
                      user.contact?.address_country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—",
                  ],
                  ["Company", user.billing?.company_name ?? "—"],
                  ["GST number", user.billing?.gst_number ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="shrink-0 text-slate-500">{label}</dt>
                    <dd className="min-w-0 break-words text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {user.roles.includes("host") && (
              <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Locations</h2>
                {locations.isLoading && !locations.meta ? (
                  <TableSkeleton columns={4} rows={3} />
                ) : locations.error ? (
                  <ErrorState message={extractErrorMessage(locations.error, "Failed to load locations.")} onRetry={locations.refresh} />
                ) : locations.rows.length === 0 ? (
                  <EmptyState title="No locations owned by this user." />
                ) : (
                  <>
                    <Table columns={locationColumns} rows={locations.rows} rowKey={(l) => l.id} caption="Locations owned by this user" />
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
            )}

            <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Bookings made</h2>
              {bookedBookings.isLoading && !bookedBookings.meta ? (
                <TableSkeleton columns={4} rows={3} />
              ) : bookedBookings.error ? (
                <ErrorState message={extractErrorMessage(bookedBookings.error, "Failed to load bookings.")} onRetry={bookedBookings.refresh} />
              ) : bookedBookings.rows.length === 0 ? (
                <EmptyState title="This user has not made any bookings." />
              ) : (
                <>
                  <Table columns={bookingColumns} rows={bookedBookings.rows} rowKey={(b) => b.id} caption="Bookings made by this user" />
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

            {user.roles.includes("host") && (
              <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Bookings hosted</h2>
                {hostedBookings.isLoading && !hostedBookings.meta ? (
                  <TableSkeleton columns={4} rows={3} />
                ) : hostedBookings.error ? (
                  <ErrorState message={extractErrorMessage(hostedBookings.error, "Failed to load bookings.")} onRetry={hostedBookings.refresh} />
                ) : hostedBookings.rows.length === 0 ? (
                  <EmptyState title="No bookings at this user's locations." />
                ) : (
                  <>
                    <Table columns={bookingColumns} rows={hostedBookings.rows} rowKey={(b) => b.id} caption="Bookings at this user's locations" />
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
            )}

            <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Audit history</h2>
              {auditLog.isLoading && !auditLog.meta ? (
                <TableSkeleton columns={3} rows={3} />
              ) : auditLog.error ? (
                <ErrorState message={extractErrorMessage(auditLog.error, "Failed to load audit history.")} onRetry={auditLog.refresh} />
              ) : auditLog.rows.length === 0 ? (
                <EmptyState title="No admin actions recorded for this user." />
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
            title={confirmAction === "suspend" ? "Suspend user" : "Restore user"}
            description={
              confirmAction === "suspend"
                ? `This also suspends every published location ${displayName(user)} owns.`
                : "This republishes only locations this user's own suspension put down."
            }
            requireReason={confirmAction === "suspend"}
            confirmLabel={confirmAction === "suspend" ? "Suspend" : "Restore"}
            danger={confirmAction === "suspend"}
            busy={busy}
            onConfirm={handleConfirm}
          />
        </>
      )}
    </>
  );
}
