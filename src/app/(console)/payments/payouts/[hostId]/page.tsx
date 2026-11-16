"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useSWR from "swr";
import { ArrowLeft, Copy, Eye } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, KeyValues } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney, personName } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Row = components["schemas"]["EarningRow"];
type Account = components["schemas"]["PayoutAccount"];
type Revealed = Account & { account_number: string; pan: string };

const STATE: Record<Row["state"], { label: string; tone: "success" | "warning" | "info" | "neutral" | "danger" }> = {
  ready: { label: "Ready", tone: "success" },
  on_hold: { label: "On hold: refund review", tone: "warning" },
  upcoming: { label: "Upcoming", tone: "info" },
  paid: { label: "Paid", tone: "neutral" },
  not_payable: { label: "Not payable", tone: "neutral" },
};

function CopyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="font-mono text-sm text-slate-900">{value}</div>
      </div>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={() => void navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied.`))}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
      >
        <Copy aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function HostPayoutPage({ params }: { params: Promise<{ hostId: string }> }) {
  const { hostId } = use(params);
  const { can } = useAdminMe();
  const canPay = can("payments.refund");
  const { data, error, isLoading, mutate } = useSWR(`/v1/admin/hosts/${hostId}/earnings`, () =>
    adminApi.GET("/hosts/{id}/earnings", { params: { path: { id: hostId } } }).then(unwrap),
  );
  const ready = useMemo(() => (data?.rows ?? []).filter((r) => r.state === "ready"), [data]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);

  useEffect(() => setSelected(new Set(ready.map((r) => r.booking_id))), [ready]);

  if (isLoading) return <Skeleton className="h-[32rem] w-full rounded-xl" />;
  if (error || !data) return <ErrorState message={extractErrorMessage(error, "Failed to load this host's earnings.")} onRetry={() => mutate()} />;

  const total = ready.filter((r) => selected.has(r.booking_id)).reduce((s, r) => s + r.net_minor_units, 0);
  const others = data.rows.filter((r) => r.state !== "ready");

  async function reveal() {
    setBusy("reveal");
    try {
      setRevealed(await adminApi.POST("/hosts/{id}/payout-account/reveal", { params: { path: { id: hostId } }, body: {} }).then(unwrap<Revealed>));
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not show the bank details."));
    } finally {
      setBusy(null);
    }
  }

  async function record() {
    setBusy("record");
    try {
      const payout = await adminApi
        .POST("/hosts/{id}/payouts", {
          params: { path: { id: hostId } },
          body: {
            booking_ids: [...selected],
            reference: reference.trim(),
            paid_at: new Date(`${paidOn}T12:00:00+05:30`).toISOString(),
            ...(note.trim() ? { note: note.trim() } : {}),
          },
        })
        .then(unwrap);
      toast.success(`Payout of ${formatMoney(payout.amount_minor_units, payout.currency)} recorded. The host can see it now.`);
      setReference("");
      setNote("");
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not record the payout."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Link href="/payments/payouts" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Host payouts
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{personName(data.host)}</h1>
          <Link href={`/users/${hostId}`} className="text-sm text-slate-500 underline hover:text-slate-800">
            View profile
          </Link>
        </div>
        <div className="flex gap-6 text-right text-sm">
          {[
            ["Ready", data.summary.ready_minor_units],
            ["On hold", data.summary.on_hold_minor_units],
            ["Upcoming", data.summary.upcoming_minor_units],
            ["Paid so far", data.summary.paid_minor_units],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="text-slate-500">{label}</div>
              <div className="font-semibold tabular-nums text-slate-900">{formatMoney(value as number, data.summary.currency)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Ready to pay" description="Untick anything you don't want in this payout.">
            {ready.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing is ready right now.</p>
            ) : (
              <ul className="-my-2 divide-y divide-slate-200">
                {ready.map((r) => (
                  <li key={r.booking_id}>
                    <label className="flex cursor-pointer items-center gap-3 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[rgb(var(--accent-600))]"
                        checked={selected.has(r.booking_id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(r.booking_id);
                          else next.delete(r.booking_id);
                          setSelected(next);
                        }}
                        disabled={!canPay}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{r.location.title}</span>
                        <span className="block text-xs text-slate-500">
                          {formatDateTime(r.start_at)} · paid {formatMoney(r.paid_minor_units, r.currency)}
                          {r.refunded_minor_units > 0 ? ` · ${formatMoney(r.refunded_minor_units, r.currency)} refunded` : ""}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">{formatMoney(r.net_minor_units, r.currency)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {others.length > 0 && (
            <Card title="Other bookings">
              <ul className="-my-2 divide-y divide-slate-200">
                {others.map((r) => (
                  <li key={r.booking_id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-900">{r.location.title}</span>
                      <span className="block text-xs text-slate-500">
                        {formatDateTime(r.start_at)}
                        {r.payout ? ` · paid ${formatDate(r.payout.paid_at)}, ref ${r.payout.reference}` : ""}
                      </span>
                    </span>
                    <Badge tone={STATE[r.state].tone}>{STATE[r.state].label}</Badge>
                    <span className="w-24 text-right text-sm tabular-nums text-slate-700">{formatMoney(r.net_minor_units, r.currency)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Payout details">
            {data.account ? (
              <>
                <KeyValues
                  items={[
                    { label: "Account holder", value: data.account.account_holder_name },
                    { label: "Account", value: `···${data.account.account_last4}` },
                    { label: "IFSC", value: data.account.ifsc },
                    { label: "Bank", value: data.account.bank_name ?? "—" },
                    { label: "PAN", value: `·····${data.account.pan_last4}` },
                    { label: "Updated", value: formatDate(data.account.updated_at) },
                  ]}
                />
                {canPay && (
                  <Button className="mt-4 w-full" onClick={() => void reveal()} disabled={busy !== null}>
                    <Eye aria-hidden className="h-4 w-4" /> {busy === "reveal" ? "Opening…" : "Show full details for transfer"}
                  </Button>
                )}
                <p className="mt-2 text-xs text-slate-500">Every time the full details are shown, it&apos;s recorded in the audit log.</p>
              </>
            ) : (
              <p className="text-sm text-amber-700">This host hasn&apos;t added payout details. They can add them on the website under Host → Payouts.</p>
            )}
          </Card>

          {canPay && data.account && ready.length > 0 && (
            <Card title="Record a payout" description="After you've sent the bank transfer.">
              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-500">
                    {selected.size} booking{selected.size === 1 ? "" : "s"}
                  </span>
                  <span className="text-xl font-semibold tabular-nums text-slate-900">{formatMoney(total, data.summary.currency)}</span>
                </div>
                <TextField label="Bank reference (UTR)" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} placeholder="e.g. HDFCN52026111712345" />
                <TextField label="Sent on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                <TextAreaField label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
                <Button variant="primary" className="w-full" onClick={() => void record()} disabled={busy !== null || selected.size === 0 || !reference.trim()}>
                  {busy === "record" ? "Recording…" : `Record ${formatMoney(total, data.summary.currency)} payout`}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {revealed && (
        <Dialog open onOpenChange={(o) => !o && setRevealed(null)} title="Bank details for the transfer" description="Close this when you're done. This view was logged.">
          <div className="space-y-2">
            <CopyValue label="Account holder" value={revealed.account_holder_name} />
            <CopyValue label="Account number" value={revealed.account_number} />
            <CopyValue label="IFSC" value={revealed.ifsc} />
            <CopyValue label="PAN" value={revealed.pan} />
            <div className="flex justify-end pt-2">
              <Button onClick={() => setRevealed(null)}>Done</Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
