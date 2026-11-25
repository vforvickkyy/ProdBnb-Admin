"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { RotateCw } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { SelectField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { EMAIL_TEMPLATE_LABELS, templateLabel } from "@/lib/emailLog";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { useAdminList } from "@/lib/useAdminList";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Email = components["schemas"]["AdminEmail"];
type Status = Email["status"] | "all";
const PAGE_SIZE = 25;

function EmailLogInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { can } = useAdminMe();
  const status = (searchParams.get("status") as Status | null) ?? "all";
  const template = searchParams.get("template") ?? "";
  const search = searchParams.get("search") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const [busyId, setBusyId] = useState<string | null>(null);

  function go(next: { status?: Status; template?: string; search?: string; page?: number }) {
    const p = new URLSearchParams();
    const s = next.status ?? status;
    const t = next.template ?? template;
    const q = next.search ?? search;
    if (s !== "all") p.set("status", s);
    if (t) p.set("template", t);
    if (q) p.set("search", q);
    if (next.page && next.page > 1) p.set("page", String(next.page));
    router.replace(`/messaging/email-log${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/emails", {
          params: {
            query: {
              page,
              pageSize: PAGE_SIZE,
              ...(status === "all" ? {} : { status }),
              ...(template ? { template: template as Email["template"] } : {}),
              ...(search ? { search } : {}),
            },
          },
        })
        .then(unwrapPaginated<Email>),
    [page, status, template, search],
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<Email>(`/v1/admin/emails?${status}&${template}&${search}&${page}`, fetcher);
  const { data: summary, mutate: refreshSummary } = useSWR("/v1/admin/emails/summary", () =>
    adminApi.GET("/emails/summary").then(unwrap<Partial<Record<Email["status"], number>>>),
  );

  async function resend(row: Email) {
    setBusyId(row.id);
    try {
      const after = await adminApi.POST("/emails/{id}/resend", { params: { path: { id: row.id } } }).then(unwrap<Email>);
      if (after.status === "sent") toast.success(`Sent to ${after.to_email}.`);
      else toast.error(after.last_error ?? "It didn't go. It will be retried.");
      void refresh();
      void refreshSummary();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not resend."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Email log"
        description="Every booking, payment, listing and payout email: who it went to and what happened. Emails that fail are retried automatically for a few hours."
      />
      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["sent", "queued", "failed", "skipped"] as const).map((s) => (
            <Card key={s}>
              <div className="text-xs text-slate-500">{s === "queued" ? "Waiting / retrying" : s === "skipped" ? "Not needed" : s[0]!.toUpperCase() + s.slice(1)} · 7 days</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{(summary[s] ?? 0) + (s === "queued" ? (summary.sending ?? 0) : 0)}</div>
            </Card>
          ))}
        </div>
      )}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Segmented<Status>
          label="Status"
          value={status}
          onChange={(next) => go({ status: next, page: 1 })}
          options={[
            { value: "all", label: "All" },
            { value: "sent", label: "Sent" },
            { value: "queued", label: "Waiting" },
            { value: "failed", label: "Failed" },
            { value: "skipped", label: "Not needed" },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <SelectField label="Email" value={template} onChange={(e) => go({ template: e.target.value, page: 1 })}>
            <option value="">All emails</option>
            {Object.entries(EMAIL_TEMPLATE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <div className="sm:w-64">
            <SearchInput label="Search emails" value={search} onChange={(v) => go({ search: v, page: 1 })} placeholder="Address or subject…" />
          </div>
        </div>
      </div>
      {isLoading && !meta ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load emails.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="No emails here" description="Booking, payment and listing emails appear here as they're sent." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">To</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500" title={formatDateTime(r.created_at)}>
                    {relativeTime(r.created_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{r.to_email}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{templateLabel(r.template)}</div>
                    {r.subject && <div className="mt-0.5 text-xs text-slate-500">{r.subject}</div>}
                    {r.last_error && r.status !== "sent" && <div className="mt-1 text-xs text-red-600">{r.last_error}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={r.status === "queued" && r.attempts > 0 ? "retrying" : r.status} />
                    {r.attempts > 1 && <div className="mt-1 text-xs text-slate-500">{r.attempts} tries</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {can("campaigns.send") && r.status !== "sending" && (
                      <Button size="sm" onClick={() => void resend(r)} disabled={busyId !== null}>
                        <RotateCw aria-hidden className="h-3.5 w-3.5" /> {busyId === r.id ? "Sending…" : r.status === "sent" ? "Send again" : "Retry now"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {meta && meta.total > PAGE_SIZE && (
        <div className="mt-4">
          <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => go({ page: p })} label="Emails" />
        </div>
      )}
    </>
  );
}

export default function EmailLogPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <EmailLogInner />
    </Suspense>
  );
}
