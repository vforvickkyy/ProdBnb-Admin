"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { RotateCw } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/Badge";
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
import { formatDateTime, relativeTime } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { useAdminList } from "@/lib/useAdminList";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Sms = components["schemas"]["AdminSms"];
type Template = components["schemas"]["SmsTemplate"];
type Status = Sms["status"] | "all";
const PAGE_SIZE = 25;

function SmsLogInner() {
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
    router.replace(`/messaging/sms-log${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/sms", {
          params: {
            query: {
              page,
              pageSize: PAGE_SIZE,
              ...(status === "all" ? {} : { status }),
              ...(template ? { template } : {}),
              ...(search ? { search } : {}),
            },
          },
        })
        .then(unwrapPaginated<Sms>),
    [page, status, template, search],
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<Sms>(`/v1/admin/sms?${status}&${template}&${search}&${page}`, fetcher);
  const { data: summary, mutate: refreshSummary } = useSWR("/v1/admin/sms/summary", () => adminApi.GET("/sms/summary").then(unwrap<Record<string, number>>));
  const { data: templates } = useSWR("/v1/admin/sms/templates", () => adminApi.GET("/sms/templates").then(unwrap<Template[]>));
  const { data: overview } = useSWR("/v1/admin/sms/settings", () => adminApi.GET("/sms/settings").then(unwrap<components["schemas"]["SmsOverview"]>));
  const names = Object.fromEntries((templates ?? []).map((t) => [t.key, t.name]));

  async function resend(row: Sms) {
    setBusyId(row.id);
    try {
      const after = await adminApi.POST("/sms/{id}/resend", { params: { path: { id: row.id } } }).then(unwrap<Sms>);
      if (after.status === "sent") toast.success("Sent.");
      else toast.error(after.last_error ?? "It didn't go. It will be retried.");
      void refresh();
      void refreshSummary();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not resend."));
    } finally {
      setBusyId(null);
    }
  }

  const mode = overview?.settings.mode;

  return (
    <>
      <PageHeader
        title="Automatic texts"
        description="Every sign-in code and booking, payment and payout text: who it went to, the exact wording and what happened. Texts that fail are retried automatically for a few hours."
        actions={
          <Link href="/messaging/sms" className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            SMS setup
          </Link>
        }
      />
      {mode && mode !== "live" && (
        <p className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {mode === "test"
            ? "Test mode: texts marked “Test” were only logged, not sent (apart from the test numbers). Sign-in codes are visible here so the team can sign in."
            : "SMS is switched off: nothing is being logged or sent."}
        </p>
      )}
      {summary && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              ["delivered", "Delivered"],
              ["sent", "Sent"],
              ["queued", "Waiting / retrying"],
              ["failed", "Failed"],
              ["test", "Test only"],
            ] as const
          ).map(([k, label]) => (
            <Card key={k}>
              <div className="text-xs text-slate-500">{label} · 7 days</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{(summary[k] ?? 0) + (k === "queued" ? summary.sending ?? 0 : 0)}</div>
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
            { value: "delivered", label: "Delivered" },
            { value: "sent", label: "Sent" },
            { value: "queued", label: "Waiting" },
            { value: "failed", label: "Failed" },
            { value: "skipped", label: "Not sent" },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <SelectField label="Text" value={template} onChange={(e) => go({ template: e.target.value, page: 1 })}>
            <option value="">All texts</option>
            {(templates ?? []).map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </SelectField>
          <div className="sm:w-64">
            <SearchInput label="Search texts" value={search} onChange={(v) => go({ search: v, page: 1 })} placeholder="Number or words…" />
          </div>
        </div>
      </div>
      {isLoading && !meta ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load texts.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="No texts here" description="Sign-in codes and booking, payment and payout texts appear here as they're sent." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">To</th>
                <th className="px-4 py-2.5 font-medium">Text</th>
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
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-800" title={r.to_phone}>
                    {r.to_phone_masked ?? r.to_phone}
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                      {names[r.template] ?? r.template.replace(/_/g, " ")}
                      {r.mode === "test" && <Badge tone="warning">Test</Badge>}
                      {r.data && (r.data as { test?: boolean }).test && <Badge tone="info">Sent from admin</Badge>}
                    </div>
                    {r.body && <div className="mt-1 text-xs leading-5 text-slate-600">{r.body}</div>}
                    {r.last_error && r.status !== "sent" && r.status !== "delivered" && <div className="mt-1 text-xs text-red-600">{r.last_error}</div>}
                    {r.provider && r.provider !== "test" && (
                      <div className="mt-1 text-[11px] text-slate-400">
                        via {r.provider}
                        {r.segments && r.segments > 1 ? ` · ${r.segments} SMS` : ""}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={r.status === "queued" && r.attempts > 0 ? "retrying" : r.status} />
                    {r.delivered_at && <div className="mt-1 text-xs text-slate-500">{relativeTime(r.delivered_at)}</div>}
                    {r.attempts > 1 && <div className="mt-1 text-xs text-slate-500">{r.attempts} tries</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {can("campaigns.send") && (r.status === "failed" || (r.status === "queued" && r.attempts > 0)) && r.template !== "auth_otp" && r.to_phone.startsWith("+") && !r.idempotency_key.startsWith("test:") && (
                      <Button size="sm" onClick={() => void resend(r)} disabled={busyId !== null}>
                        <RotateCw aria-hidden className="h-3.5 w-3.5" /> {busyId === r.id ? "Sending…" : "Retry now"}
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
          <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => go({ page: p })} label="Texts" />
        </div>
      )}
    </>
  );
}

export default function SmsLogPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <SmsLogInner />
    </Suspense>
  );
}
