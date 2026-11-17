"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { Column, Table } from "@/components/ui/Table";
import { SendDialog } from "@/components/invoices/SendDialog";
import type { Receipt } from "@/components/invoices/invoiceText";
import { adminApi, downloadAdminFile, unwrap, unwrapPaginated } from "@/lib/api";
import { formatDateTime, formatMoney, humanize, personName } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { useAdminMe } from "@/lib/useAdminMe";

const PAGE_SIZE = 25;
const METHOD: Record<string, string> = { upi: "UPI", credit_card: "Credit card", debit_card: "Debit card", net_banking: "Net banking", wallet: "Wallet" };

function ReceiptsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { can } = useAdminMe();
  const page = Number(params.get("page") ?? 1) || 1;
  const [sending, setSending] = useState<Receipt | null>(null);
  const { data, error, isLoading, mutate } = useSWR(`/v1/admin/receipts?page=${page}`, () =>
    adminApi.GET("/receipts", { params: { query: { page, pageSize: PAGE_SIZE } } }).then(unwrapPaginated<Receipt>),
  );
  const name = (r: Receipt) => `RCPT-${r.payment_id.slice(0, 8).toUpperCase()}.pdf`;

  const columns: Column<Receipt>[] = [
    { key: "receipt", header: "Receipt", render: (r) => <span className="font-mono font-semibold text-slate-900">RCPT-{r.payment_id.slice(0, 8).toUpperCase()}</span> },
    { key: "paid", header: "Paid", render: (r) => formatDateTime(r.paid_at) },
    {
      key: "booker",
      header: "Booker",
      render: (r) => (
        <div>
          <p className="text-slate-900">{r.booker ? personName(r.booker) : "—"}</p>
          <Link href={`/bookings/${r.booking_id}`} className="text-xs text-accent-700 hover:underline">
            {r.listing ?? "Booking"}
          </Link>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (r) => (
        <div className="tabular-nums">
          <p>{formatMoney(r.amount_minor_units, r.currency)}</p>
          {r.refunded_minor_units > 0 && <p className="text-xs text-red-700">− {formatMoney(r.refunded_minor_units, r.currency)} refunded</p>}
        </div>
      ),
    },
    { key: "method", header: "Method", render: (r) => (r.method ? (METHOD[r.method] ?? humanize(r.method)) : "—") },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge tone={r.status === "success" ? "success" : "warning"} dot>
          {r.status === "success" ? "Paid" : humanize(r.status)}
        </Badge>
      ),
    },
    { key: "invoice", header: "Invoice", render: (r) => (r.invoice_number ? <span className="font-mono text-xs">{r.invoice_number}</span> : <span className="text-slate-400">Not issued</span>) },
    { key: "sent", header: "Last emailed", render: (r) => (r.last_sent_at ? formatDateTime(r.last_sent_at) : <span className="text-slate-400">Never</span>) },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Download receipt for ${r.booker ? personName(r.booker) : "booking"}`}
            onClick={() => downloadAdminFile(`/receipts/${r.payment_id}/pdf`, name(r)).catch((err) => toast.error(extractErrorMessage(err, "Couldn't download the PDF.")))}
          >
            <Download aria-hidden className="h-3.5 w-3.5" />
          </Button>
          {can("invoices.manage") && (
            <Button size="sm" onClick={() => setSending(r)}>
              Email
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Receipts"
        description="Proof of payment for every settled payment, with refunds taken off. A receipt isn't a tax invoice: that's under Invoices."
      />
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : error || !data ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load receipts.")} onRetry={() => mutate()} />
      ) : data.data.length === 0 ? (
        <EmptyState title="No payments yet" description="Receipts appear here once bookers pay." />
      ) : (
        <>
          <Table columns={columns} rows={data.data} rowKey={(r) => r.payment_id} caption="Receipts" />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.meta.total}
            onPageChange={(p) => router.replace(`/payments/receipts?page=${p}`, { scroll: false })}
            label="Receipts pages"
          />
        </>
      )}
      <SendDialog
        open={Boolean(sending)}
        onOpenChange={(o) => !o && setSending(null)}
        title="Email receipt"
        description="The receipt PDF is attached to the email."
        defaultTo={null}
        blankMeansBooker
        onSend={async (to) => {
          const r = unwrap(await adminApi.POST("/receipts/{id}/send", { params: { path: { id: sending!.payment_id } }, body: to ? { to } : {} }));
          mutate();
          return r.to;
        }}
      />
    </>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <ReceiptsInner />
    </Suspense>
  );
}
