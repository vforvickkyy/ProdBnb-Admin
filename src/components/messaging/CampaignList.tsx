"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BellRing, Mail } from "lucide-react";
import { audienceLabel, CAMPAIGN_TONE, ChannelIcons } from "@/components/messaging/campaignDisplay";
import { ReadinessStrip } from "@/components/messaging/ReadinessStrip";
import { useMessagingOverview, type Campaign } from "@/components/messaging/useMessaging";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { Column, Table } from "@/components/ui/Table";
import { adminApi, unwrapPaginated } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { useAdminList } from "@/lib/useAdminList";
import { useAdminMe } from "@/lib/useAdminMe";

type Status = "" | "draft" | "scheduled" | "sending" | "sent";

export const rate = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");

/** Marketing campaigns that use one channel: email (designed emails) or push (+ in-app). */
export function CampaignList({ channel }: { channel: "email" | "push" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1");
  const status = (searchParams.get("status") ?? "") as Status;
  const { can } = useAdminMe();
  const overview = useMessagingOverview();
  const base = `/marketing/${channel}`;
  const { rows, meta, isLoading, error, refresh } = useAdminList<Campaign>(`/v1/admin/campaigns?channel=${channel}&page=${page}&status=${status}`, () =>
    adminApi
      .GET("/campaigns", { params: { query: { page, pageSize: 20, kind: "announcement", channel, ...(status ? { status } : {}) } as never } })
      .then(unwrapPaginated<Campaign>),
  );

  const columns: Column<Campaign>[] = [
    {
      key: "name",
      header: "Campaign",
      render: (c) => (
        <Link href={`/marketing/${c.id}`} className="group block min-w-0">
          <span className="block truncate font-medium text-slate-900 group-hover:underline">{c.name}</span>
          <span className="block truncate text-xs text-slate-500">{channel === "email" ? (c.email_subject ?? c.title) : c.title}</span>
        </Link>
      ),
    },
    { key: "audience", header: "To", render: (c) => <span className="text-slate-700">{audienceLabel(c.audience)}</span> },
    ...(channel === "push" ? [{ key: "via", header: "Via", render: (c: Campaign) => <ChannelIcons channels={c.channels} /> }] : []),
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <div className="flex flex-col items-start gap-0.5">
          <Badge tone={CAMPAIGN_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
          {c.status === "scheduled" && c.scheduled_at && <span className="text-xs text-slate-500">{relativeTime(c.scheduled_at)}</span>}
        </div>
      ),
    },
    ...(channel === "email"
      ? [
          { key: "sent", header: "Sent", render: (c: Campaign) => <span className="tabular-nums text-slate-700">{c.stats.email_sent || "—"}</span> },
          { key: "opened", header: "Opened", render: (c: Campaign) => <span className="tabular-nums text-slate-700">{rate(c.stats.email_opened, c.stats.email_sent)}</span> },
          { key: "clicked", header: "Clicked", render: (c: Campaign) => <span className="tabular-nums text-slate-700">{rate(c.stats.email_clicked, c.stats.email_sent)}</span> },
        ]
      : [
          {
            key: "reach",
            header: "Delivered",
            render: (c: Campaign) =>
              c.stats.total === 0 ? (
                <span className="text-slate-400">—</span>
              ) : (
                <span className="text-xs text-slate-600">
                  {c.stats.in_app_created} in-app{c.channels.includes("push") && ` · ${c.stats.push_sent} push`}
                </span>
              ),
          },
        ]),
    { key: "when", header: "Created", render: (c) => <span className="text-xs text-slate-500">{formatDateTime(c.created_at)}</span> },
  ];

  const Icon = channel === "email" ? Mail : BellRing;
  return (
    <>
      <PageHeader
        title={channel === "email" ? "Email campaigns" : "Push campaigns"}
        description={
          channel === "email"
            ? "Designed emails to people who get news and offers: listing spotlights, collections, offers and news. Opens and clicks are tracked."
            : "Notifications on phones and browsers, plus the in-app inbox."
        }
        actions={
          can("campaigns.send") && (
            <Link
              href={`/marketing/new?channel=${channel}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-500 px-3 text-[13px] font-medium text-snow shadow-sm transition-colors hover:bg-accent-600"
            >
              <Icon aria-hidden className="h-4 w-4" /> New {channel === "email" ? "email" : "push"} campaign
            </Link>
          )
        }
      />
      <div className="mb-6">{overview.data ? <ReadinessStrip overview={overview.data} /> : <Skeleton className="h-16 w-full" />}</div>
      <div className="mb-4">
        <Segmented<Status>
          label="Filter campaigns"
          value={status}
          options={[
            { value: "", label: "All" },
            { value: "draft", label: "Drafts" },
            { value: "scheduled", label: "Scheduled" },
            { value: "sent", label: "Sent" },
          ]}
          onChange={(v) => router.push(`${base}${v ? `?status=${v}` : ""}`)}
        />
      </div>
      {isLoading && !meta ? (
        <TableSkeleton columns={6} />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load campaigns.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No campaigns here yet."
          description={channel === "email" ? "Start with a listing spotlight, then send a test to yourself before sending to everyone." : "Start with a short push and send a test to yourself first."}
        />
      ) : (
        <>
          <Table columns={columns} rows={rows} rowKey={(c) => c.id} caption="Campaigns" />
          {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => router.push(`${base}?page=${p}${status ? `&status=${status}` : ""}`)} label="Campaigns" />}
        </>
      )}
    </>
  );
}
