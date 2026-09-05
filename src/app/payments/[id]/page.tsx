"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useSWR from "swr";
import { AdminShell } from "@/components/AdminShell";
import { StatusBadge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import type { components } from "@/types/admin-api";

type AdminPaymentDetail = components["schemas"]["AdminPaymentDetail"];

function name(n: { first_name: string | null; last_name: string | null } | null | undefined): string {
  if (!n) return "—";
  return [n.first_name, n.last_name].filter(Boolean).join(" ") || "(no name)";
}

function formatAmount(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(minorUnits / 100);
}

const REFUNDABLE = new Set(["success", "partially_refunded"]);

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [refundOpen, setRefundOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: payment, error, isLoading, mutate } = useSWR(`/v1/admin/payments/${id}`, () =>
    adminApi.GET("/payments/{id}", { params: { path: { id } } }).then(unwrap<AdminPaymentDetail>)
  );

  async function handleRefund() {
    setBusy(true);
    try {
      const amountMinorUnits = amount.trim() ? Math.round(Number(amount) * 100) : undefined;
      await adminApi
        .POST("/payments/{id}/refunds", {
          params: { path: { id } },
          body: { amount_minor_units: amountMinorUnits, reason: reason.trim() || undefined },
        })
        .then(unwrap);
      toast.success("Refund issued.");
      setRefundOpen(false);
      setAmount("");
      setReason("");
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to issue refund."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <Link href="/payments" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Back to payments
      </Link>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error || !payment ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load this payment.")} onRetry={() => mutate()} />
      ) : (
        <>
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold">{payment.booking?.location?.title ?? "Payment"}</h1>
              <p className="text-sm text-slate-500">
                {payment.provider} · {payment.provider_order_id}
              </p>
            </div>
            <StatusBadge status={payment.status} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Details</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Booker</dt>
                  <dd>{name(payment.booking?.booker)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Amount</dt>
                  <dd>{formatAmount(payment.amount_minor_units, payment.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Created</dt>
                  <dd>{new Date(payment.created_at).toLocaleString()}</dd>
                </div>
                {payment.failure_reason && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Failure reason</dt>
                    <dd className="text-red-700">{payment.failure_reason}</dd>
                  </div>
                )}
                {payment.booking && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Booking</dt>
                    <dd>
                      <Link href={`/bookings/${payment.booking.id}`} className="underline hover:text-slate-900">
                        View booking →
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            <section className="rounded border border-amber-200 bg-amber-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-amber-900">Operational notes</h2>
              <ul className="list-disc space-y-1 pl-4 text-sm text-amber-800">
                <li>Refunds are issued through the same PaymentProvider architecture as any other refund — never a direct Cashfree call.</li>
                <li>Omitting an amount refunds the full remaining, unrefunded balance.</li>
                <li>Every refund here is audit-logged automatically.</li>
              </ul>
            </section>
          </div>

          {REFUNDABLE.has(payment.status) && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setRefundOpen(true)}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Issue refund
              </button>
            </div>
          )}

          <Dialog open={refundOpen} onOpenChange={setRefundOpen} title="Issue refund" description={payment.booking?.location?.title}>
            <div className="mb-3">
              <label htmlFor="refund-amount" className="mb-1 block text-sm text-slate-600">
                Amount (leave blank for full remaining balance)
              </label>
              <input
                id="refund-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Up to ${formatAmount(payment.amount_minor_units, payment.currency)}`}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="refund-reason" className="mb-1 block text-sm text-slate-600">
                Reason (optional)
              </label>
              <textarea
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <p className="mb-4 text-xs text-amber-700">This action is irreversible.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundOpen(false)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRefund}
                disabled={busy}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Issuing…" : "Issue refund"}
              </button>
            </div>
          </Dialog>
        </>
      )}
    </AdminShell>
  );
}
