"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { Megaphone, Send } from "lucide-react";
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
import { useAdminList } from "@/lib/useAdminList";
import { useAdminMe } from "@/lib/useAdminMe";

export default function MessagingPage() {
  return (
    <Suspense fallback={<><TableSkeleton columns={5} /></>}>
      <Messaging />
    </Suspense>
  );
}

function Messaging() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1");
  const kind = (searchParams.get("kind") ?? "") as "" | "announcement" | "direct";
  const { can } = useAdminMe();
  const overview = useMessagingOverview();
  const listKey = `/v1/admin/campaigns?page=${page}&kind=${kind}`;
  const { rows, meta, isLoading, error, refresh } = useAdminList<Campaign>(listKey, () =>
    adminApi.GET("/campaigns", { params: { query: { page, pageSize: 20, kind: kind || undefined } } }).then(unwrapPaginated<Campaign>)
  );

  const columns: Column<Campaign>[] = [
    {
      key: "name",
      header: "Message",
      render: (c) => (
        <Link href={`${c.kind === "announcement" ? "/marketing" : "/messaging"}/${c.id}`} className="group block min-w-0">
          <span className="block truncate font-medium text-slate-900 group-hover:underline">{c.name}</span>
          <span className="block truncate text-xs text-slate-500">{c.title}</span>
        </Link>
      ),
    },
    { key: "audience", header: "To", render: (c) => <span className="text-slate-700">{audienceLabel(c.audience)}</span> },
    { key: "channels", header: "Via", render: (c) => <ChannelIcons channels={c.channels} /> },
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
    {
      key: "reach",
      header: "Delivered",
      render: (c) =>
        c.stats.total === 0 ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span className="text-xs text-slate-600">
            {c.stats.processed}/{c.stats.total} processed
            {c.channels.includes("push") && ` · ${c.stats.push_sent} push`}
            {c.channels.includes("email") && ` · ${c.stats.email_sent} email`}
          </span>
        ),
    },
    { key: "when", header: "Created", render: (c) => <span className="text-xs text-slate-500">{formatDateTime(c.created_at)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Sent messages"
        description="Everything sent from the console: direct messages to chosen people, and marketing campaigns (manage those under Marketing)."
        actions={
          can("campaigns.send") && (
            <>
              <Link
                href="/messaging/new?kind=direct"
                className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 shadow-card transition-colors hover:bg-slate-50"
              >
                <Send aria-hidden className="h-4 w-4" /> Message people
              </Link>
              <Link
                href="/marketing"
                className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-accent-500 px-3 text-[13px] font-medium text-snow shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Megaphone aria-hidden className="h-4 w-4" /> Marketing campaigns
              </Link>
            </>
          )
        }
      />

      <div className="mb-6">{overview.data ? <ReadinessStrip overview={overview.data} /> : <Skeleton className="h-16 w-full" />}</div>

      <div className="mb-4">
        <Segmented
          label="Filter messages"
          value={kind}
          options={[
            { value: "", label: "All" },
            { value: "announcement", label: "Campaigns" },
            { value: "direct", label: "Direct" },
          ]}
          onChange={(v) => router.push(`/messaging${v ? `?kind=${v}` : ""}`)}
        />
      </div>

      {isLoading && !meta ? (
        <TableSkeleton columns={6} />
      ) : error ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load messages.")} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing sent yet." description="Start with a test to yourself: New announcement → Send test to me." />
      ) : (
        <>
          <Table columns={columns} rows={rows} rowKey={(c) => c.id} caption="Messages" />
          {meta && <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} onPageChange={(p) => router.push(`/messaging?page=${p}${kind ? `&kind=${kind}` : ""}`)} label="Messages" />}
        </>
      )}

    </>
  );
}
