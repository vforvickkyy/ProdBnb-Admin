"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useSWR from "swr";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Column, Table } from "@/components/ui/Table";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { LocationEditDialog } from "@/components/LocationEditDialog";
import { LocationGallery } from "@/components/LocationGallery";
import { Button } from "@/components/ui/Button";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { useAdminMe } from "@/lib/useAdminMe";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type LocationDetail = components["schemas"]["LocationDetail"];
type AdminUserDetail = components["schemas"]["AdminUserDetail"];
type BookingDetail = components["schemas"]["BookingDetail"];
type AuditLogEntry = components["schemas"]["AuditLogEntry"];
type Action = "approve" | "reject" | "suspend" | "restore";

const SUB_PAGE_SIZE = 5;
const MODERATABLE = new Set(["submitted", "under_review", "published", "suspended"]);

function formatAmount(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(minorUnits / 100);
}

function hostDisplayName(h: { first_name: string | null; last_name: string | null }): string {
  const name = [h.first_name, h.last_name].filter(Boolean).join(" ");
  return name || "(no name set)";
}

function propPrice(p: { price_minor_units: number | null; price_unit: string | null }): string {
  if (p.price_minor_units === null) return "for hire, ask the host";
  const unit = p.price_unit === "per_hour" ? "hour" : p.price_unit === "per_day" ? "day" : "booking";
  return `for hire, ₹${(p.price_minor_units / 100).toLocaleString("en-IN")} per ${unit}`;
}

const ELECTRICITY_LABEL: Record<string, string> = {
  included: "Included in the price",
  extra: "Charged extra",
  not_available: "Not available",
};

const actionCopy: Record<Action, { title: string; requireReason: boolean; danger: boolean; label: string }> = {
  approve: { title: "Approve location", requireReason: false, danger: false, label: "Approve" },
  reject: { title: "Reject location", requireReason: true, danger: true, label: "Reject" },
  suspend: { title: "Suspend location", requireReason: true, danger: true, label: "Suspend" },
  restore: { title: "Restore location", requireReason: false, danger: false, label: "Restore" },
};

export default function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [confirmAction, setConfirmAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { can } = useAdminMe();

  const { data: location, error, isLoading, mutate } = useSWR(`/v1/admin/locations/${id}`, () =>
    adminApi.GET("/locations/{id}", { params: { path: { id } } }).then(unwrap<LocationDetail>)
  );

  // §22.1: when the host's own public-profile RPC returns null (a host with
  // no other currently-published location), fall back to the already-
  // existing admin user detail endpoint using the still-present host_id --
  // never a new backend endpoint, and only fired for that specific case.
  const needsHostFallback = Boolean(location && location.host === null && location.host_id);
  const { data: hostFallback, error: hostFallbackError } = useSWR(
    needsHostFallback ? `/v1/admin/users/${location!.host_id}` : null,
    () => adminApi.GET("/users/{id}", { params: { path: { id: location!.host_id } } }).then(unwrap<AdminUserDetail>)
  );

  const [bookingsPage, setBookingsPage] = useState(1);
  const bookingsFetcher = useCallback(
    () =>
      adminApi.GET("/bookings", { params: { query: { location_id: id, page: bookingsPage, pageSize: SUB_PAGE_SIZE } } }).then(unwrapPaginated<BookingDetail>),
    [id, bookingsPage]
  );
  const bookings = useAdminList<BookingDetail>(`/v1/admin/bookings?location_id=${id}&page=${bookingsPage}`, bookingsFetcher);

  const [auditPage, setAuditPage] = useState(1);
  const auditFetcher = useCallback(
    () =>
      adminApi
        .GET("/audit-log", { params: { query: { target_type: "location", target_id: id, page: auditPage, pageSize: SUB_PAGE_SIZE } } })
        .then(unwrapPaginated<AuditLogEntry>),
    [id, auditPage]
  );
  const auditLog = useAdminList<AuditLogEntry>(`/v1/admin/audit-log?target_type=location&target_id=${id}&page=${auditPage}`, auditFetcher);

  async function handleConfirm(reason?: string) {
    if (!confirmAction || !location) return;
    setBusy(true);
    try {
      if (confirmAction === "approve") {
        await adminApi.POST("/locations/{id}/approve", { params: { path: { id } }, body: {} }).then(unwrap);
      } else if (confirmAction === "restore") {
        await adminApi.POST("/locations/{id}/restore", { params: { path: { id } }, body: {} }).then(unwrap);
      } else if (confirmAction === "reject") {
        await adminApi.POST("/locations/{id}/reject", { params: { path: { id } }, body: { reason: reason! } }).then(unwrap);
      } else {
        await adminApi.POST("/locations/{id}/suspend", { params: { path: { id } }, body: { reason: reason! } }).then(unwrap);
      }
      toast.success(
        `"${location.title}" ${confirmAction === "approve" ? "approved" : confirmAction === "restore" ? "restored" : confirmAction + "ed"}.`
      );
      setConfirmAction(null);
      await mutate();
      await auditLog.refresh();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Action failed."));
    } finally {
      setBusy(false);
    }
  }

  const bookingColumns: Column<BookingDetail>[] = [
    { key: "booker", header: "Booker", render: (b) => (b.booker ? hostDisplayName(b.booker) : "—") },
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
      <Link href="/locations" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Back to locations
      </Link>

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error || !location ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load this location.")} onRetry={() => mutate()} />
      ) : (
        <>
          <div className="mb-6 flex items-start justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-xl font-semibold">{location.title}</h1>
              {location.listing_code && (
                <p className="mt-0.5">
                  <span
                    title="Listing ID — only the host and the team see it"
                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700"
                  >
                    {location.listing_code}
                  </span>
                </p>
              )}
              <p className="break-words text-sm text-slate-500">
                {location.city}, {location.region ? `${location.region}, ` : ""}
                {location.country}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={location.status} />
              {location.status === "suspended" && (
                <Badge tone="neutral">{location.suspended_by_host_suspension ? "Host account suspended" : "Policy violation"}</Badge>
              )}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Details</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-slate-500">Address</dt>
                  <dd className="min-w-0 break-words text-right">
                    {location.address_line1 ?? "—"}
                    {location.address_line2 ? `, ${location.address_line2}` : ""}
                    {location.postal_code ? `, ${location.postal_code}` : ""}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Max crew size</dt>
                  <dd>{location.capacity ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Area</dt>
                  <dd>{location.area_sqft != null ? `${location.area_sqft.toLocaleString("en-IN")} sq ft` : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Sets</dt>
                  <dd>{location.set_count ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Parking spaces</dt>
                  <dd>{location.parking_spaces ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Restrooms</dt>
                  <dd>{location.restroom_count ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Electricity</dt>
                  <dd>{ELECTRICITY_LABEL[location.electricity ?? ""] ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-slate-500">Permission to shoot</dt>
                  <dd className="min-w-0 break-words text-right">
                    {location.permission_needed == null
                      ? "—"
                      : location.permission_needed
                        ? `Needed${location.permission_details ? `: ${location.permission_details}` : ""}`
                        : "Not needed"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Timezone</dt>
                  <dd>{location.timezone}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-slate-500">Area</dt>
                  <dd className="min-w-0 break-words text-right">{location.area ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-slate-500">Before booking</dt>
                  <dd className="min-w-0 text-right">
                    {location.show_exact_location
                      ? "Exact address and pin shown"
                      : "Area and 2 km circle only"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Instant booking</dt>
                  <dd>{location.instant_booking_enabled ? "Enabled" : "Disabled"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Prices</dt>
                  <dd>{location.price_on_request ? "On request" : "Shown"}</dd>
                </div>
                {location.moderation_reason && (
                  <div className="flex justify-between gap-4">
                    <dt className="shrink-0 text-slate-500">Moderation reason</dt>
                    <dd className="min-w-0 break-words text-right text-red-700">{location.moderation_reason}</dd>
                  </div>
                )}
              </dl>
              {location.description && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{location.description}</p>}
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Host</h2>
              {location.host ? (
                <p className="text-sm text-slate-700">{hostDisplayName(location.host)}</p>
              ) : hostFallback ? (
                <div className="text-sm text-slate-700">
                  <p>{hostDisplayName(hostFallback)}</p>
                  <p className="text-slate-500">{hostFallback.email ?? "No email on file"}</p>
                  <StatusBadge status={hostFallback.status} />
                </div>
              ) : hostFallbackError ? (
                <p className="text-sm text-slate-400">Host information unavailable.</p>
              ) : (
                <p className="text-sm text-slate-400">Loading host…</p>
              )}
              <Link href={`/users/${location.host_id}`} className="mt-2 inline-block text-sm underline hover:text-slate-900">
                View host profile →
              </Link>
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Categories, amenities &amp; use cases</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="mb-1 text-slate-500">Categories</p>
                  <div className="flex flex-wrap gap-1">
                    {location.categories.length === 0 ? (
                      <span className="text-slate-400">None set</span>
                    ) : (
                      location.categories.map((c) => <Badge key={c.id}>{c.name}</Badge>)
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-slate-500">Amenities</p>
                  <div className="flex flex-wrap gap-1">
                    {location.amenities.length === 0 && (location.custom_amenities ?? []).length === 0 ? (
                      <span className="text-slate-400">None set</span>
                    ) : (
                      <>
                        {location.amenities.map((a) => (
                          <Badge key={a.id}>{a.name}</Badge>
                        ))}
                        {(location.custom_amenities ?? []).map((a) => (
                          <Badge key={`custom-${a}`}>{a}</Badge>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-slate-500">Location rules</p>
                  <div className="flex flex-wrap gap-1">
                    {(location.rules ?? []).length === 0 && (location.custom_rules ?? []).length === 0 ? (
                      <span className="text-slate-400">None set</span>
                    ) : (
                      <>
                        {(location.rules ?? []).map((r) => (
                          <Badge key={r.id}>{r.name}</Badge>
                        ))}
                        {(location.custom_rules ?? []).map((r) => (
                          <Badge key={`custom-${r}`}>{r}</Badge>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-slate-500">Props</p>
                  {(location.props ?? []).length === 0 ? (
                    <span className="text-slate-400">None set</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {(location.props ?? []).map((p) => (
                        <li key={p.name} className="text-slate-700">
                          {p.name} <span className="text-slate-400">— {p.kind === "included" ? "included" : propPrice(p)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-slate-500">Use cases</p>
                  <div className="flex flex-wrap gap-1">
                    {location.use_cases.length === 0 ? (
                      <span className="text-slate-400">None set</span>
                    ) : (
                      location.use_cases.map((u) => <Badge key={u.id}>{u.name}</Badge>)
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Pricing</h2>
              {location.booking_options.length === 0 ? (
                <p className="text-sm text-slate-400">No active pricing configured.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {location.booking_options.map((opt) => (
                    <li key={opt.type} className="flex justify-between">
                      <span className="text-slate-500">{opt.type.replace(/_/g, " ")}</span>
                      <span>{formatAmount(opt.amount_minor_units, opt.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Media</h2>
              <LocationGallery
                locationId={id}
                fallbackMedia={location.media}
                canModerate={can("locations.moderate")}
                onChanged={() => {
                  void mutate();
                  void auditLog.refresh();
                }}
              />
            </section>

            <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Bookings</h2>
              {bookings.isLoading && !bookings.meta ? (
                <TableSkeleton columns={4} rows={3} />
              ) : bookings.error ? (
                <ErrorState message={extractErrorMessage(bookings.error, "Failed to load bookings.")} onRetry={bookings.refresh} />
              ) : bookings.rows.length === 0 ? (
                <EmptyState title="No bookings for this location." />
              ) : (
                <>
                  <Table columns={bookingColumns} rows={bookings.rows} rowKey={(b) => b.id} caption="Bookings for this location" />
                  {bookings.meta && (
                    <Pagination
                      page={bookings.meta.page}
                      pageSize={bookings.meta.pageSize}
                      total={bookings.meta.total}
                      onPageChange={setBookingsPage}
                      label="Bookings"
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
                <EmptyState title="No admin actions recorded for this location." />
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

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {can("locations.moderate") && (
              <>
                <Link
                  href={`/locations/${id}/edit`}
                  className="inline-flex items-center h-8 rounded-lg bg-accent-500 px-3 text-[13px] font-medium text-snow shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Open full editor
                </Link>
                <Button onClick={() => setEditOpen(true)}>Quick edit</Button>
              </>
            )}
            {can("messages.access") && (
              <Link href={`/conversations?location_id=${id}`} className="text-sm text-slate-600 underline hover:text-slate-900">
                Conversations about this listing
              </Link>
            )}
          </div>

          <LocationEditDialog
            location={location}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSaved={() => {
              void mutate();
              void auditLog.refresh();
            }}
          />

          {MODERATABLE.has(location.status) && can("locations.moderate") && (
            <div className="mt-3 flex gap-2">
              {(location.status === "submitted" || location.status === "under_review") && (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmAction("approve")}
                    className="h-8 rounded-lg bg-accent-500 px-3 text-[13px] font-medium text-snow shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction("reject")}
                    className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {location.status === "published" && (
                <button
                  type="button"
                  onClick={() => setConfirmAction("suspend")}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Suspend
                </button>
              )}
              {location.status === "suspended" && (
                <button
                  type="button"
                  onClick={() => setConfirmAction("restore")}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 shadow-card transition-colors hover:bg-slate-50"
                >
                  Restore
                </button>
              )}
            </div>
          )}

          {confirmAction && (
            <ConfirmDialog
              open={confirmAction !== null}
              onOpenChange={(open) => !open && setConfirmAction(null)}
              title={actionCopy[confirmAction].title}
              description={`"${location.title}"`}
              requireReason={actionCopy[confirmAction].requireReason}
              confirmLabel={actionCopy[confirmAction].label}
              danger={actionCopy[confirmAction].danger}
              busy={busy}
              onConfirm={handleConfirm}
            />
          )}
        </>
      )}
    </>
  );
}
