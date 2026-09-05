"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Column, Table } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrapPaginated } from "@/lib/api";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type DeliveryAttemptRow = components["schemas"]["DeliveryAttemptRow"];

const PAGE_SIZE = 5;

// "skipped" is what every attempt made under NOTIFICATION_PROVIDER=disabled
// honestly reports -- a normal, expected configuration state, not a
// failure, so it gets a neutral tone rather than red/amber.
const STATUS_TONE: Record<string, "success" | "danger" | "neutral"> = {
  sent: "success",
  failed: "danger",
  invalid_token: "danger",
  skipped: "neutral",
};

/**
 * Embedded directly in Booking Detail -- GET /v1/admin/notifications/
 * delivery-attempts requires either notification_id or booking_id, and this
 * is the one place in the Admin Panel a booking_id is already on hand, so
 * there's no standalone /notifications route to link this from.
 */
export function NotificationDeliveryPanel({ bookingId }: { bookingId: string }) {
  const [page, setPage] = useState(1);
  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/notifications/delivery-attempts", { params: { query: { booking_id: bookingId, page, pageSize: PAGE_SIZE } } })
        .then(unwrapPaginated<DeliveryAttemptRow>),
    [bookingId, page]
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<DeliveryAttemptRow>(
    `/v1/admin/notifications/delivery-attempts?booking_id=${bookingId}&page=${page}`,
    fetcher
  );

  const columns: Column<DeliveryAttemptRow>[] = [
    { key: "provider", header: "Provider", render: (a) => a.provider },
    {
      key: "status",
      header: "Status",
      render: (a) => <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status.replace(/_/g, " ")}</Badge>,
    },
    { key: "platform", header: "Device platform", render: (a) => a.device?.platform ?? "—" },
    { key: "environment", header: "Device environment", render: (a) => a.device?.environment ?? "—" },
    {
      key: "device_status",
      header: "Device status",
      render: (a) =>
        a.device ? <Badge tone={a.device.is_active ? "success" : "neutral"}>{a.device.is_active ? "Active" : "Inactive"}</Badge> : "—",
    },
    { key: "error_reason", header: "Error reason", className: "text-slate-500", render: (a) => a.error_reason ?? "—" },
    { key: "created_at", header: "Created", render: (a) => new Date(a.created_at).toLocaleString() },
  ];

  return (
    <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Notification delivery</h2>
      {isLoading && !meta ? (
        <TableSkeleton columns={7} rows={3} />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load notification delivery attempts.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="No delivery attempts recorded yet" />
      ) : (
        <>
          <Table columns={columns} rows={rows} rowKey={(a) => a.id} caption="Notification delivery attempts for this booking" />
          {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={setPage} label="Notification delivery" />}
        </>
      )}
    </section>
  );
}
