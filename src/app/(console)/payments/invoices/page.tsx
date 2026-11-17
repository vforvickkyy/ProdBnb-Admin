"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { AlertTriangle, Download, FileText, Mail, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Column, Table } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { SendDialog } from "@/components/invoices/SendDialog";
import { deliveryBadge, EVENT_LABEL, pdfName, type DeliveryFilter, type Invoice } from "@/components/invoices/invoiceText";
import { adminApi, downloadAdminFile, unwrap } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney, personName } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { useAdminMe } from "@/lib/useAdminMe";

const PAGE_SIZE = 25;
type Counts = { all: number; pending: number; sent_auto: number; sent_manual: number; failed: number; waiting: number };

const BANNER = "mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm";

function download(inv: Pick<Invoice, "id" | "number">) {
  downloadAdminFile(`/invoices/${inv.id}/pdf`, pdfName(inv.number)).catch((err) => toast.error(extractErrorMessage(err, "Couldn't download the PDF.")));
}

function InvoiceSheet({ id, onClose, onSend, canSend }: { id: string | null; onClose: () => void; onSend: (inv: Invoice) => void; canSend: boolean }) {
  const { data, error } = useSWR(id ? `/v1/admin/invoices/${id}` : null, () => adminApi.GET("/invoices/{id}", { params: { path: { id: id! } } }).then(unwrap));
  const badge = data ? deliveryBadge(data) : null;
  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()} title={data?.number ?? "Invoice"} description="Tax invoice for a paid booking" width="max-w-lg">
      {error ? (
        <p className="text-sm text-red-700">{extractErrorMessage(error, "Couldn't load the invoice.")}</p>
      ) : !data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="space-y-6 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {badge && <Badge tone={badge.tone} dot>{badge.label}</Badge>}
            {data.sent_to && <span className="text-slate-500">to {data.sent_to}</span>}
          </div>
          {data.last_error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">
              <span className="font-medium">Last error:</span> {data.last_error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => download(data)}>
              <Download aria-hidden className="h-4 w-4" /> Download PDF
            </Button>
            {canSend && (
              <Button variant="primary" onClick={() => onSend(data)}>
                <Mail aria-hidden className="h-4 w-4" /> {data.delivery_status === "sent" ? "Resend" : "Send now"}
              </Button>
            )}
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2">
            <dt className="text-slate-500">Billed to</dt>
            <dd className="text-slate-900">
              {data.billed_to.name}
              {data.billed_to.company && <span className="block text-slate-500">{data.billed_to.company}</span>}
              {data.billed_to.gstin && <span className="block text-slate-500">GSTIN {data.billed_to.gstin}</span>}
            </dd>
            <dt className="text-slate-500">Email</dt>
            <dd className="text-slate-900">{data.billed_to.email ?? "—"}</dd>
            <dt className="text-slate-500">Location</dt>
            <dd className="text-slate-900">{[data.details.listing, data.details.city].filter(Boolean).join(", ")}</dd>
            <dt className="text-slate-500">When</dt>
            <dd className="text-slate-900">{data.details.when}</dd>
            <dt className="text-slate-500">Booking</dt>
            <dd>
              <Link href={`/bookings/${data.booking_id}`} className="font-mono text-accent-700 hover:underline">
                {data.details.booking_ref}
              </Link>
            </dd>
            <dt className="text-slate-500">Issued</dt>
            <dd className="text-slate-900">{formatDateTime(data.issued_at)}</dd>
          </dl>
          <div className="rounded-xl border border-slate-200">
            {[
              ["Listing price", data.subtotal_minor_units],
              ...(data.discount_minor_units ? [[`Discount${data.coupon_code ? ` (${data.coupon_code})` : ""}`, -data.discount_minor_units]] : []),
              ...(data.service_fee_minor_units ? [["Service fee", data.service_fee_minor_units]] : []),
              ...(data.tax_minor_units ? [[`${data.tax_label}${data.tax_rate_bps ? ` (${data.tax_rate_bps / 100}%)` : ""}`, data.tax_minor_units]] : []),
            ].map(([label, amount]) => (
              <div key={label as string} className="flex justify-between border-b border-slate-100 px-4 py-2 last:border-0">
                <span className="text-slate-600">{label}</span>
                <span className="tabular-nums text-slate-900">{(amount as number) < 0 ? `− ${formatMoney(-(amount as number))}` : formatMoney(amount as number)}</span>
              </div>
            ))}
            <div className="flex justify-between bg-slate-50 px-4 py-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(data.total_minor_units)}</span>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-[13px] font-semibold text-slate-900">History</h3>
            <ol className="space-y-2">
              {data.events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.kind === "failed" ? "bg-red-500" : e.kind === "issued" ? "bg-slate-400" : "bg-green-500"}`} />
                  <div>
                    <p className="text-slate-900">
                      {EVENT_LABEL[e.kind]}
                      {e.to_email && <span className="text-slate-500"> to {e.to_email}</span>}
                      {e.actor && <span className="text-slate-500"> by {personName(e.actor)}</span>}
                    </p>
                    {e.error && <p className="text-xs text-red-700">{e.error}</p>}
                    <p className="text-xs text-slate-500">{formatDateTime(e.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function InvoicesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { can } = useAdminMe();
  const filter = (params.get("filter") as DeliveryFilter | null) ?? "all";
  const page = Number(params.get("page") ?? 1) || 1;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sending, setSending] = useState<Invoice | null>(null);
  const [confirm, setConfirm] = useState<"issue" | "send" | null>(null);
  const go = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(`/payments/invoices?${p}`, { scroll: false });
  };
  const q = params.get("q") ?? "";
  const key = `/v1/admin/invoices?filter=${filter}&page=${page}&q=${q}`;
  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    const res = await adminApi.GET("/invoices", { params: { query: { filter, page, pageSize: PAGE_SIZE, ...(q ? { search: q } : {}) } } });
    if (res.error || !res.data) throw res.error ?? new Error("Failed to load invoices.");
    return res.data as unknown as { data: Invoice[]; meta: { page: number; pageSize: number; total: number; counts: Counts } };
  });
  const { data: settings } = useSWR("/v1/admin/invoice-settings", () => adminApi.GET("/invoice-settings").then(unwrap));
  const counts = data?.meta.counts;
  const canManage = can("invoices.manage");

  async function bulk(kind: "issue" | "send") {
    try {
      if (kind === "issue") {
        const r = unwrap(await adminApi.POST("/invoices/issue-missing"));
        toast.success(r.issued ? `Issued ${r.issued} invoice${r.issued === 1 ? "" : "s"}. They're waiting under "Pending to send".` : "Nothing to issue.");
      } else {
        const r = unwrap(await adminApi.POST("/invoices/send-pending"));
        if (r.failed) toast.warning(`Sent ${r.sent}; ${r.failed} didn't go. They're under "Failed".`);
        else toast.success(r.sent ? `Sent ${r.sent} invoice${r.sent === 1 ? "" : "s"}.` : "Nothing was waiting.");
      }
      mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "That didn't work."));
    }
  }

  const columns: Column<Invoice>[] = [
    {
      key: "number",
      header: "Invoice",
      render: (i) => (
        <button type="button" onClick={() => setOpenId(i.id)} className="font-mono font-semibold text-slate-900 underline-offset-2 hover:underline">
          {i.number}
        </button>
      ),
    },
    {
      key: "to",
      header: "Billed to",
      render: (i) => (
        <div>
          <p className="text-slate-900">{i.billed_to.name}</p>
          <p className="text-xs text-slate-500">{i.billed_to.email ?? "No email"}</p>
        </div>
      ),
    },
    { key: "listing", header: "Location", render: (i) => <span className="text-slate-700">{i.details.listing}</span> },
    { key: "total", header: "Total", render: (i) => <span className="tabular-nums">{formatMoney(i.total_minor_units)}</span> },
    { key: "issued", header: "Issued", render: (i) => formatDate(i.issued_at) },
    {
      key: "status",
      header: "Email",
      render: (i) => {
        const b = deliveryBadge(i);
        return (
          <div>
            <Badge tone={b.tone} dot>
              {b.label}
            </Badge>
            {i.sent_at && <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(i.sent_at)}</p>}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (i) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => download(i)} aria-label={`Download ${i.number}`}>
            <Download aria-hidden className="h-3.5 w-3.5" />
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setSending(i)}>
              {i.delivery_status === "sent" ? "Resend" : "Send"}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const tab = (v: DeliveryFilter, label: string, n?: number, tone?: string) => ({
    value: v,
    label,
    badge: n ? <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tone ?? "bg-slate-100 text-slate-600"}`}>{n}</span> : undefined,
  });

  return (
    <>
      <PageHeader
        title="Invoices"
        description="One tax invoice per paid booking, for everything the booker paid. Invoices are emailed automatically when email is set up; anything that couldn't go waits here to be sent."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/payments/invoice-template"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 shadow-card hover:bg-slate-50"
            >
              <FileText aria-hidden className="h-4 w-4" /> Invoice template
            </Link>
            {canManage && counts && counts.pending + counts.failed > 0 && (
              <Button variant="primary" onClick={() => setConfirm("send")} disabled={settings ? !settings.email_connected : false}>
                <Send aria-hidden className="h-4 w-4" /> Send all pending ({counts.pending + counts.failed})
              </Button>
            )}
          </div>
        }
      />

      {settings && settings.missing.length > 0 && (
        <div className={`${BANNER} border-amber-200 bg-amber-50 text-amber-900`}>
          <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
          <p className="flex-1">
            Invoices can&apos;t be issued until the template has the company&apos;s {settings.missing.join(" and ")}. Paid bookings wait until then.
          </p>
          <Link href="/payments/invoice-template" className="font-medium underline underline-offset-2">
            Fill in the template
          </Link>
        </div>
      )}
      {settings && !settings.email_connected && (
        <div className={`${BANNER} border-slate-200 bg-slate-50 text-slate-700`}>
          <Mail aria-hidden className="h-4 w-4 shrink-0" />
          <p className="flex-1">Email isn&apos;t connected, so new invoices wait under &ldquo;Pending to send&rdquo;. You can still download them.</p>
          <Link href="/messaging/email" className="font-medium underline underline-offset-2">
            Connect email
          </Link>
        </div>
      )}
      {settings && settings.missing.length === 0 && counts && counts.waiting > 0 && (
        <div className={`${BANNER} border-accent-200 bg-accent-50 text-accent-900`}>
          <FileText aria-hidden className="h-4 w-4 shrink-0" />
          <p className="flex-1">
            {counts.waiting} paid booking{counts.waiting === 1 ? " has" : "s have"} no invoice yet (paid before the template was filled in).
          </p>
          {canManage && (
            <Button size="sm" variant="primary" onClick={() => setConfirm("issue")}>
              Issue {counts.waiting} invoice{counts.waiting === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      )}

      <Tabs<DeliveryFilter>
        label="Invoices by email status"
        value={filter}
        onChange={(v) => go({ filter: v, page: "" })}
        items={[
          tab("all", "All", counts?.all),
          tab("pending", "Pending to send", counts?.pending, "bg-amber-100 text-amber-800"),
          tab("sent_auto", "Sent automatically", counts?.sent_auto),
          tab("sent_manual", "Sent manually", counts?.sent_manual),
          tab("failed", "Failed", counts?.failed, "bg-red-100 text-red-700"),
        ]}
      />
      <div className="mb-4 max-w-sm">
        <SearchInput
          label="Search invoices"
          placeholder="Number, name or email"
          value={search}
          onChange={(v) => {
            setSearch(v);
            go({ q: v, page: "" });
          }}
        />
      </div>
      <div role="tabpanel" id={`panel-${filter}`} aria-labelledby={`tab-${filter}`}>
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : error || !data ? (
          <ErrorState message={extractErrorMessage(error, "Failed to load invoices.")} onRetry={() => mutate()} />
        ) : data.data.length === 0 ? (
          <EmptyState
            title={filter === "pending" ? "Nothing waiting to be sent" : filter === "failed" ? "No failed emails" : "No invoices here yet"}
            description={filter === "all" ? "Invoices appear here as bookings are paid." : "Invoices move here by how their email went."}
          />
        ) : (
          <>
            <Table columns={columns} rows={data.data} rowKey={(i) => i.id} caption="Invoices" />
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.meta.total} onPageChange={(p) => go({ page: String(p) })} label="Invoices pages" />
          </>
        )}
      </div>

      <InvoiceSheet id={openId} onClose={() => setOpenId(null)} onSend={setSending} canSend={canManage} />
      <SendDialog
        open={Boolean(sending)}
        onOpenChange={(o) => !o && setSending(null)}
        title={sending ? `Email ${sending.number}` : "Email invoice"}
        description="The PDF is attached to the email."
        defaultTo={sending?.billed_to.email ?? null}
        onSend={async (to) => {
          const inv = unwrap(await adminApi.POST("/invoices/{id}/send", { params: { path: { id: sending!.id } }, body: to ? { to } : {} }));
          mutate();
          return inv.sent_to ?? to ?? "";
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "issue" ? "Issue missing invoices?" : "Send every pending invoice?"}
        description={
          confirm === "issue"
            ? "Each paid booking without an invoice gets one, numbered in order. They won't be emailed yet: you can check them and then send."
            : "Every invoice that's pending or failed is emailed to its booker now."
        }
        confirmLabel={confirm === "issue" ? "Issue invoices" : "Send all"}
        onConfirm={async () => {
          const kind = confirm!;
          setConfirm(null);
          await bulk(kind);
        }}
      />
    </>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <InvoicesInner />
    </Suspense>
  );
}
