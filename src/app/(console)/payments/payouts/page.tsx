"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { Column, Table } from "@/components/ui/Table";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { formatDate, formatMoney, personName } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import type { components } from "@/types/admin-api";

type HostDue = components["schemas"]["HostDue"];
type Payout = components["schemas"]["Payout"];
type View = "due" | "history";

function DueList() {
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/payouts/due", () => adminApi.GET("/payouts/due").then(unwrap<HostDue[]>));
  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (error || !data) return <ErrorState message={extractErrorMessage(error, "Failed to load payouts due.")} onRetry={() => mutate()} />;
  if (data.length === 0) return <EmptyState title="Nobody is owed anything right now" description="Hosts appear here once a paid shoot has happened." />;
  const total = data.reduce((s, d) => s + d.ready_minor_units, 0);
  return (
    <Card title={`${formatMoney(total)} to pay`} description="Ready = the shoot happened, the payment is settled and no refund is under review. On hold = waiting for a refund decision.">
      <ul className="-my-2 divide-y divide-slate-200">
        {data.map((d) => (
          <li key={d.host.id}>
            <Link
              href={`/payments/payouts/${d.host.id}`}
              className="flex flex-wrap items-center gap-4 rounded-md py-3 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 sm:flex-nowrap"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">{personName(d.host)}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {d.account ? (
                    <>
                      {d.account.bank_name ?? d.account.ifsc} ···{d.account.account_last4}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <AlertTriangle aria-hidden className="h-3.5 w-3.5" /> No payout details yet
                    </span>
                  )}
                </div>
              </div>
              {d.on_hold_minor_units > 0 && <Badge tone="warning">{formatMoney(d.on_hold_minor_units)} on hold</Badge>}
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums text-slate-900">{formatMoney(d.ready_minor_units, d.currency)}</div>
                <div className="text-xs text-slate-500">
                  {d.ready_bookings} booking{d.ready_bookings === 1 ? "" : "s"}
                </div>
              </div>
              <ChevronRight aria-hidden className="h-4 w-4 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function History() {
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/payouts?page=1", () =>
    adminApi.GET("/payouts", { params: { query: { page: 1, pageSize: 100 } } }).then(unwrapPaginated<Payout>),
  );
  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (error || !data) return <ErrorState message={extractErrorMessage(error, "Failed to load payouts.")} onRetry={() => mutate()} />;
  if (data.data.length === 0) return <EmptyState title="No payouts recorded yet" />;
  const columns: Column<Payout>[] = [
    { key: "paid", header: "Paid", render: (p) => formatDate(p.paid_at) },
    {
      key: "host",
      header: "Host",
      render: (p) => (
        <Link href={`/payments/payouts/${p.host_id}`} className="underline hover:text-slate-900">
          View host
        </Link>
      ),
    },
    { key: "amount", header: "Amount", render: (p) => <span className="font-medium tabular-nums">{formatMoney(p.amount_minor_units, p.currency)}</span> },
    { key: "bookings", header: "Bookings", render: (p) => p.booking_count },
    { key: "to", header: "Sent to", render: (p) => (p.account_last4 ? `${p.ifsc ?? ""} ···${p.account_last4}` : "—") },
    { key: "ref", header: "Reference", render: (p) => <span className="font-mono text-xs">{p.reference}</span> },
  ];
  return <Table columns={columns} rows={data.data} rowKey={(p) => p.id} caption="Payouts" />;
}

function PayoutsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const view = (params.get("view") as View | null) ?? "due";
  return (
    <>
      <PageHeader
        title="Host payouts"
        description="Hosts earn the listing price of each paid booking (less any refunded share). Send the money by bank transfer, then record it here with the bank's reference so the host sees it."
      />
      <div className="mb-5">
        <Segmented<View>
          label="View"
          value={view}
          onChange={(v) => router.replace(`/payments/payouts?view=${v}`, { scroll: false })}
          options={[
            { value: "due", label: "To pay" },
            { value: "history", label: "Paid" },
          ]}
        />
      </div>
      {view === "due" ? <DueList /> : <History />}
    </>
  );
}

export default function PayoutsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <PayoutsInner />
    </Suspense>
  );
}
