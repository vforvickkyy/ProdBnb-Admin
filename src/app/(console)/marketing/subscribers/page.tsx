"use client";

import { Suspense, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Badge } from "@/components/ui/Badge";
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
import { formatCount, formatDateTime, relativeTime } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { useAdminList } from "@/lib/useAdminList";
import type { components } from "@/types/admin-api";

type Subscriber = components["schemas"]["EmailSubscriber"];
type Status = Subscriber["status"] | "all";
type Summary = { people: number; subscribed: number; unsubscribed: number; bounced: number; no_email: number; hosts_subscribed: number; bookers_subscribed: number };
const PAGE_SIZE = 25;

const STATUS: Record<Subscriber["status"], { label: string; tone: "success" | "neutral" | "danger" | "warning"; help: string }> = {
  subscribed: { label: "Gets news", tone: "success", help: "Receives news and offers by email." },
  unsubscribed: { label: "Unsubscribed", tone: "neutral", help: "Turned off news and offers (or reported spam). Booking emails still go out." },
  bounced: { label: "Bounced", tone: "danger", help: "The address doesn't accept mail; nothing is sent." },
  no_email: { label: "No email", tone: "warning", help: "Signed up by phone; no email address." },
};

function Subscribers() {
  const router = useRouter();
  const sp = useSearchParams();
  const status = (sp.get("status") as Status | null) ?? "all";
  const role = (sp.get("role") ?? "") as "" | "booker" | "host";
  const search = sp.get("search") ?? "";
  const page = Number(sp.get("page") ?? "1");

  function go(next: { status?: Status; role?: string; search?: string; page?: number }) {
    const p = new URLSearchParams();
    const s = next.status ?? status;
    const r = next.role ?? role;
    const q = next.search ?? search;
    if (s !== "all") p.set("status", s);
    if (r) p.set("role", r);
    if (q) p.set("search", q);
    if (next.page && next.page > 1) p.set("page", String(next.page));
    router.replace(`/marketing/subscribers${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  const summary = useSWR("/v1/admin/email-subscribers/summary", () => adminApi.GET("/email-subscribers/summary").then(unwrap<Summary>));
  const fetcher = useCallback(
    () =>
      adminApi
        .GET("/email-subscribers", {
          params: {
            query: {
              page,
              pageSize: PAGE_SIZE,
              ...(status === "all" ? {} : { status }),
              ...(role ? { role } : {}),
              ...(search ? { search } : {}),
            },
          },
        })
        .then(unwrapPaginated<Subscriber>),
    [page, status, role, search],
  );
  const { rows, meta, isLoading, error, refresh } = useAdminList<Subscriber>(`/v1/admin/email-subscribers?${status}&${role}&${search}&${page}`, fetcher);
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Subscribers"
        description="Who gets news and offers by email. People switch it off from their account settings or the unsubscribe link in any marketing email; addresses that bounce are stopped automatically. Booking and account emails always go out."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {s ? (
          <>
            <Card>
              <div className="text-xs text-slate-500">Get news by email</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatCount(s.subscribed)}</div>
              <div className="text-xs text-slate-500">
                of {formatCount(s.people)} people · {s.people ? Math.round((s.subscribed / s.people) * 100) : 0}%
              </div>
            </Card>
            <Card>
              <div className="text-xs text-slate-500">Bookers · Hosts subscribed</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatCount(s.bookers_subscribed)} · {formatCount(s.hosts_subscribed)}
              </div>
            </Card>
            <Card>
              <div className="text-xs text-slate-500">Unsubscribed</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatCount(s.unsubscribed)}</div>
            </Card>
            <Card>
              <div className="text-xs text-slate-500">Bounced · No email</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatCount(s.bounced)} · {formatCount(s.no_email)}
              </div>
            </Card>
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        )}
      </div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Segmented<Status>
          label="Status"
          value={status}
          onChange={(v) => go({ status: v, page: 1 })}
          options={[
            { value: "all", label: "Everyone" },
            { value: "subscribed", label: "Gets news" },
            { value: "unsubscribed", label: "Unsubscribed" },
            { value: "bounced", label: "Bounced" },
            { value: "no_email", label: "No email" },
          ]}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <SelectField label="Role" value={role} onChange={(e) => go({ role: e.target.value, page: 1 })}>
            <option value="">Bookers and hosts</option>
            <option value="booker">Bookers</option>
            <option value="host">Hosts</option>
          </SelectField>
          <div className="sm:w-64">
            <SearchInput label="Search people" value={search} onChange={(v) => go({ search: v, page: 1 })} placeholder="Name or email…" />
          </div>
        </div>
      </div>
      {isLoading && !meta ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load people.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nobody here" description="Try another filter." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">News and offers</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/users/${r.user_id}`} className="block hover:underline">
                      <span className="block text-slate-900">{r.name ?? "—"}</span>
                      <span className="block text-xs text-slate-500">{r.email ?? "no email"}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{r.roles.filter((x) => x !== "admin").join(", ") || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    {r.status_since && (
                      <div className="mt-1 text-xs text-slate-500" title={formatDateTime(r.status_since)}>
                        since {relativeTime(r.status_since)}
                      </div>
                    )}
                    <div className="mt-0.5 text-xs text-slate-400">{STATUS[r.status].help}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{relativeTime(r.joined_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {meta && meta.total > PAGE_SIZE && (
        <div className="mt-4">
          <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => go({ page: p })} label="People" />
        </div>
      )}
    </>
  );
}

export default function SubscribersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <Subscribers />
    </Suspense>
  );
}
