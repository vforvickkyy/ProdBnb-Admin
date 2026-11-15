"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWR from "swr";
import { AdminShell } from "@/components/AdminShell";
import { NotificationDeliveryPanel } from "@/components/NotificationDeliveryPanel";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type BookingDetail = components["schemas"]["AdminBooking"];
type Action = "cancel" | "confirm" | "reject" | "complete";

const ACTIONS: Record<Action, { title: string; description: string; label: string; danger?: boolean; reasonRequired?: boolean; done: string }> = {
  cancel: {
    title: "Cancel booking",
    description: "This releases the booked interval immediately. The reason is optional but recommended. Cancelling does not refund — refund from the payment if money was taken.",
    label: "Cancel booking",
    danger: true,
    done: "Booking cancelled.",
  },
  confirm: { title: "Confirm on the host's behalf", description: "The booker is notified that their booking is confirmed.", label: "Confirm booking", done: "Booking confirmed." },
  reject: {
    title: "Reject on the host's behalf",
    description: "The slot is released and the booker is notified. Refund separately if they paid.",
    label: "Reject booking",
    danger: true,
    done: "Booking rejected.",
  },
  complete: { title: "Mark as completed", description: "Use once the shoot has happened.", label: "Mark completed", done: "Booking marked completed." },
};
type AuditLogEntry = components["schemas"]["AuditLogEntry"];

function name(n: { first_name: string | null; last_name: string | null } | null | undefined): string {
  if (!n) return "—";
  return [n.first_name, n.last_name].filter(Boolean).join(" ") || "(no name)";
}

function formatAmount(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(minorUnits / 100);
}

const CANCELLABLE = new Set(["requested", "confirmed"]);

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const { can } = useAdminMe();

  const { data: booking, error, isLoading, mutate } = useSWR(`/v1/admin/bookings/${id}`, () =>
    adminApi.GET("/bookings/{id}", { params: { path: { id } } }).then(unwrap<BookingDetail>)
  );

  const { data: auditLog } = useSWR(`/v1/admin/audit-log?target_type=booking&target_id=${id}`, () =>
    adminApi
      .GET("/audit-log", { params: { query: { target_type: "booking", target_id: id, pageSize: 20 } } })
      .then(unwrapPaginated<AuditLogEntry>)
  );

  async function runAction(reason?: string) {
    if (!action) return;
    setBusy(true);
    const path = { params: { path: { id } } };
    try {
      if (action === "cancel") await adminApi.POST("/bookings/{id}/cancel", { ...path, body: { reason: reason || undefined } }).then(unwrap);
      if (action === "reject") await adminApi.POST("/bookings/{id}/reject", { ...path, body: { reason: reason || undefined } }).then(unwrap);
      if (action === "confirm") await adminApi.POST("/bookings/{id}/confirm", { ...path, body: {} }).then(unwrap);
      if (action === "complete") await adminApi.POST("/bookings/{id}/complete", { ...path, body: {} }).then(unwrap);
      toast.success(ACTIONS[action].done);
      setAction(null);
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "That action failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <button type="button" onClick={() => router.push("/bookings")} className="mb-4 text-sm text-slate-500 hover:text-slate-800">
        ← Back to bookings
      </button>

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error || !booking ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load this booking.")} onRetry={() => mutate()} />
      ) : (
        <>
          <div className="mb-6 flex items-start justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-xl font-semibold">{booking.location.title}</h1>
              <p className="text-sm text-slate-500">
                {booking.booking_type.replace("_", " ")} · {new Date(booking.start_at).toLocaleString()} –{" "}
                {new Date(booking.end_at).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          {booking.hold_expires_at && (
            <p className="mb-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-inset ring-brand-200">
              Unpaid: this booking holds its slot without a payment. The hold {new Date(booking.hold_expires_at).getTime() < Date.now() ? "has lapsed and will be released within a minute" : `expires ${relativeTime(booking.hold_expires_at)} (${formatDateTime(booking.hold_expires_at)})`}, unless a checkout is in progress. The host cannot see it until it is paid.
            </p>
          )}
          {booking.hold_expired_at && (
            <p className="mb-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              Cancelled automatically {formatDateTime(booking.hold_expired_at)} because payment was not completed in time.
            </p>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Parties</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Booker</dt>
                  <dd className="min-w-0 break-words text-right">{name(booking.booker)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Host</dt>
                  <dd className="min-w-0 break-words text-right">{name(booking.location.host)}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Pricing snapshot</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Base amount</dt>
                  <dd>{formatAmount(booking.pricing.base_amount_minor_units, booking.pricing.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Platform fee</dt>
                  <dd>{formatAmount(booking.pricing.platform_fee_minor_units, booking.pricing.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tax</dt>
                  <dd>{formatAmount(booking.pricing.tax_minor_units, booking.pricing.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Discount</dt>
                  <dd>-{formatAmount(booking.pricing.discount_minor_units, booking.pricing.currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-medium">
                  <dt>Total</dt>
                  <dd>{formatAmount(booking.pricing.total_amount_minor_units, booking.pricing.currency)}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Payments</h2>
              {booking.payments.length === 0 ? (
                <p className="text-sm text-slate-400">No payment created for this booking yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {booking.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2">
                      <Link href={`/payments/${p.id}`} className="text-slate-700 underline hover:text-slate-900">
                        {formatAmount(p.amount_minor_units, booking.pricing.currency)} · {new Date(p.created_at).toLocaleString()}
                      </Link>
                      <StatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <NotificationDeliveryPanel bookingId={id} />

            {booking.status === "cancelled" && (
              <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Cancellation</h2>
                <p className="text-sm text-slate-600">
                  Cancelled {booking.cancelled_at && new Date(booking.cancelled_at).toLocaleString()}
                  {booking.cancellation_reason && ` — ${booking.cancellation_reason}`}
                </p>
              </section>
            )}

            <section className="rounded border border-slate-200 bg-white p-4 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Audit history</h2>
              {!auditLog || auditLog.data.length === 0 ? (
                <p className="text-sm text-slate-400">No admin actions recorded for this booking.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {auditLog.data.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between">
                      <span>
                        {entry.action.replace(/_/g, " ").toLowerCase()}
                        {entry.reason && ` — ${entry.reason}`}
                      </span>
                      <span className="text-slate-400">{new Date(entry.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {can("bookings.manage") && booking.status === "requested" && (
              <>
                <Button variant="primary" onClick={() => setAction("confirm")}>
                  Confirm
                </Button>
                <Button variant="danger" onClick={() => setAction("reject")}>
                  Reject
                </Button>
              </>
            )}
            {can("bookings.manage") && booking.status === "confirmed" && (
              <Button onClick={() => setAction("complete")}>Mark completed</Button>
            )}
            {can("bookings.manage") && CANCELLABLE.has(booking.status) && (
              <Button variant="danger" onClick={() => setAction("cancel")}>
                Cancel booking
              </Button>
            )}
            {can("messages.access") && (
              <Link href={`/conversations?booking_id=${id}`} className="ml-auto self-center text-sm text-slate-600 underline hover:text-slate-900">
                Conversations about this booking
              </Link>
            )}
          </div>

          {action && (
            <ConfirmDialog
              open
              onOpenChange={(open) => !open && setAction(null)}
              title={ACTIONS[action].title}
              description={ACTIONS[action].description}
              confirmLabel={ACTIONS[action].label}
              danger={ACTIONS[action].danger}
              optionalReason={action === "cancel" || action === "reject"}
              busy={busy}
              onConfirm={runAction}
            />
          )}
        </>
      )}
    </AdminShell>
  );
}
