"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWR from "swr";
import { AdminShell } from "@/components/AdminShell";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import type { components } from "@/types/admin-api";

type BookingDetail = components["schemas"]["BookingDetail"];
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: booking, error, isLoading, mutate } = useSWR(`/v1/admin/bookings/${id}`, () =>
    adminApi.GET("/bookings/{id}", { params: { path: { id } } }).then(unwrap<BookingDetail>)
  );

  const { data: auditLog } = useSWR(`/v1/admin/audit-log?target_type=booking&target_id=${id}`, () =>
    adminApi
      .GET("/audit-log", { params: { query: { target_type: "booking", target_id: id, pageSize: 20 } } })
      .then(unwrapPaginated<AuditLogEntry>)
  );

  async function handleCancel(reason?: string) {
    setBusy(true);
    try {
      await adminApi.POST("/bookings/{id}/cancel", { params: { path: { id } }, body: { reason: reason || undefined } }).then(unwrap);
      toast.success("Booking cancelled.");
      setConfirmOpen(false);
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to cancel booking."));
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
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error || !booking ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load this booking.")} onRetry={() => mutate()} />
      ) : (
        <>
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold">{booking.location.title}</h1>
              <p className="text-sm text-slate-500">
                {booking.booking_type.replace("_", " ")} · {new Date(booking.start_at).toLocaleString()} –{" "}
                {new Date(booking.end_at).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Parties</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Booker</dt>
                  <dd>{name(booking.booker)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Host</dt>
                  <dd>{name(booking.location.host)}</dd>
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

          {CANCELLABLE.has(booking.status) && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Cancel booking
              </button>
            </div>
          )}

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Cancel booking"
            description="This releases the booked interval immediately. The reason is optional but recommended."
            confirmLabel="Cancel booking"
            danger
            busy={busy}
            onConfirm={handleCancel}
          />
        </>
      )}
    </AdminShell>
  );
}
