"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, CreditCard, MapPin, User } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { formatDateTime, formatMoney, humanize, personName, relativeTime } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { useAdminList } from "@/lib/useAdminList";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type RefundRequest = components["schemas"]["AdminRefundRequest"];
type Status = "pending" | "approved" | "declined" | "withdrawn" | "all";

const PAGE_SIZE = 20;
const SOURCE_LABEL: Record<RefundRequest["source"], string> = {
  booker: "Booker asked",
  cancellation: "Booking cancelled",
  rejection: "Host declined",
};
const METHOD_LABEL: Record<string, string> = {
  upi: "UPI",
  credit_card: "Credit card",
  debit_card: "Debit card",
  net_banking: "Net banking",
  wallet: "Wallet",
  pay_later: "Pay later",
  cardless_emi: "Cardless EMI",
};

function ApproveDialog({ request, onClose, onDone }: { request: RefundRequest; onClose: () => void; onDone: () => void }) {
  const remaining = request.remaining_minor_units;
  const [mode, setMode] = useState<"full" | "part">("full");
  const [rupees, setRupees] = useState(String(Math.round(remaining / 2) / 100));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = mode === "full" ? remaining : Math.round(Number(rupees) * 100);
  const invalid = mode === "part" && (!Number.isFinite(amount) || amount < 100 || amount > remaining);

  async function approve() {
    setBusy(true);
    try {
      await adminApi
        .POST("/refund-requests/{id}/approve", {
          params: { path: { id: request.id } },
          body: { ...(mode === "part" ? { amount_minor_units: amount } : {}), ...(note.trim() ? { note: note.trim() } : {}) },
        })
        .then(unwrap);
      toast.success(`Refund of ${formatMoney(amount)} sent to the booker's original payment method.`);
      onDone();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not issue the refund."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Approve refund" description="Money goes back to the payment method the booker used. This can't be undone.">
      <div className="space-y-4">
        <Segmented
          label="Refund amount"
          value={mode}
          onChange={setMode}
          options={[
            { value: "full", label: `Full ${formatMoney(remaining)}` },
            { value: "part", label: "Part" },
          ]}
        />
        {mode === "part" && (
          <TextField
            label="Amount (₹)"
            type="number"
            min={1}
            step="0.01"
            max={remaining / 100}
            value={rupees}
            onChange={(e) => setRupees(e.target.value)}
            error={invalid ? `Between ₹1 and ${formatMoney(remaining)}.` : undefined}
          />
        )}
        <TextAreaField label="Note to the booker (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void approve()} disabled={busy || invalid}>
            {busy ? "Refunding…" : `Refund ${formatMoney(Number.isFinite(amount) ? amount : 0)}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function DeclineDialog({ request, onClose, onDone }: { request: RefundRequest; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function decline() {
    setBusy(true);
    try {
      await adminApi.POST("/refund-requests/{id}/decline", { params: { path: { id: request.id } }, body: { note: note.trim() } }).then(unwrap);
      toast.success("Refund request declined. The booker has been told.");
      onDone();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not decline the request."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Decline refund request" description="The booker sees your note on their booking.">
      <div className="space-y-4">
        <TextAreaField
          label="Why (shown to the booker)"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          placeholder="e.g. Cancelled within 48 hours of the shoot, which isn't refundable under our policy."
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void decline()} disabled={busy || !note.trim()}>
            {busy ? "Declining…" : "Decline request"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function RequestCard({ request, canDecide, onAction }: { request: RefundRequest; canDecide: boolean; onAction: (a: "approve" | "decline") => void }) {
  const booking = request.booking;
  const payment = request.payment;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} />
            <Badge tone={request.source === "booker" ? "info" : "neutral"}>{SOURCE_LABEL[request.source]}</Badge>
            <span className="text-xs text-slate-500" title={formatDateTime(request.created_at)}>
              {relativeTime(request.created_at)}
            </span>
          </div>
          {booking && (
            <div className="grid gap-x-6 gap-y-1.5 text-[13px] text-slate-600 sm:grid-cols-2">
              <span className="flex items-center gap-2">
                <MapPin aria-hidden className="h-3.5 w-3.5 text-slate-400" />
                <Link href={`/bookings/${booking.id}`} className="truncate font-medium text-slate-900 hover:underline">
                  {booking.location?.title ?? "Booking"}
                </Link>
                {booking.location?.city ? <span className="text-slate-400">· {booking.location.city}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                <User aria-hidden className="h-3.5 w-3.5 text-slate-400" />
                {booking.booker ? (
                  <Link href={`/users/${booking.booker.id}`} className="hover:underline">
                    {personName(booking.booker)}
                  </Link>
                ) : (
                  "Booker"
                )}
              </span>
              <span className="flex items-center gap-2">
                <CalendarDays aria-hidden className="h-3.5 w-3.5 text-slate-400" />
                {formatDateTime(booking.start_at)} · booking {humanize(booking.status).toLowerCase()}
              </span>
              {payment && (
                <span className="flex items-center gap-2">
                  <CreditCard aria-hidden className="h-3.5 w-3.5 text-slate-400" />
                  <Link href={`/payments/${payment.id}`} className="hover:underline">
                    {formatMoney(payment.amount_minor_units, payment.currency)}
                  </Link>
                  {payment.method ? <span className="text-slate-400">· {METHOD_LABEL[payment.method] ?? humanize(payment.method)}</span> : null}
                </span>
              )}
            </div>
          )}
          {request.reason && <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">“{request.reason}”</p>}
          {request.status !== "pending" && request.decision_note && (
            <p className="text-[13px] text-slate-500">
              <span className="font-medium text-slate-700">Team note:</span> {request.decision_note}
            </p>
          )}
        </div>
        <div className="w-full space-y-3 sm:w-56">
          <dl className="space-y-1 text-[13px]">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Already refunded</dt>
              <dd className="tabular-nums text-slate-900">{formatMoney(request.refunded_minor_units)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{request.status === "approved" ? "Approved" : "Refundable"}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {formatMoney(request.status === "approved" ? (request.approved_amount_minor_units ?? 0) : request.remaining_minor_units)}
              </dd>
            </div>
          </dl>
          {request.status === "pending" && canDecide && (
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => onAction("approve")} disabled={request.remaining_minor_units <= 0}>
                Approve
              </Button>
              <Button className="flex-1" onClick={() => onAction("decline")}>
                Decline
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function RefundRequestsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { can } = useAdminMe();
  const canDecide = can("payments.refund");
  const status = (searchParams.get("status") as Status | null) ?? "pending";
  const page = Number(searchParams.get("page") ?? "1");
  const [acting, setActing] = useState<{ request: RefundRequest; action: "approve" | "decline" } | null>(null);

  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/refund-requests", { params: { query: { page, pageSize: PAGE_SIZE, ...(status === "all" ? {} : { status }) } } })
        .then(unwrapPaginated<RefundRequest>),
    [page, status],
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<RefundRequest>(`/v1/admin/refund-requests?status=${status}&page=${page}`, fetcher);

  return (
    <>
      <PageHeader
        title="Refund requests"
        description="Opened when a paid booking is cancelled or declined, or when a booker reports a problem. Nothing is refunded until someone approves it here."
      />
      <div className="mb-5">
        <Segmented<Status>
          label="Status"
          value={status}
          onChange={(next) => router.replace(`/payments/refund-requests?status=${next}`, { scroll: false })}
          options={[
            { value: "pending", label: "To review" },
            { value: "approved", label: "Approved" },
            { value: "declined", label: "Declined" },
            { value: "withdrawn", label: "Withdrawn" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      {isLoading && !meta ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load refund requests.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title={status === "pending" ? "Nothing to review" : "No refund requests here"} description={status === "pending" ? "New requests appear here as they come in." : undefined} />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <RequestCard key={r.id} request={r} canDecide={canDecide} onAction={(action) => setActing({ request: r, action })} />
          ))}
          {meta && meta.total > PAGE_SIZE && (
            <Pagination
              page={meta.page}
              pageSize={meta.pageSize}
              total={meta.total}
              onPageChange={(p) => router.push(`/payments/refund-requests?status=${status}&page=${p}`)}
              label="Refund requests"
            />
          )}
        </div>
      )}
      {!canDecide && rows.some((r) => r.status === "pending") && (
        <p className="mt-4 text-sm text-slate-500">Only finance and super admins can approve or decline refunds.</p>
      )}
      {acting?.action === "approve" && (
        <ApproveDialog request={acting.request} onClose={() => setActing(null)} onDone={() => { setActing(null); void refresh(); }} />
      )}
      {acting?.action === "decline" && (
        <DeclineDialog request={acting.request} onClose={() => setActing(null)} onDone={() => { setActing(null); void refresh(); }} />
      )}
    </>
  );
}

export default function RefundRequestsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <RefundRequestsInner />
    </Suspense>
  );
}
