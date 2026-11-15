"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, Send } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { audienceLabel, CAMPAIGN_TONE, ChannelIcons } from "@/components/messaging/campaignDisplay";
import { ReadinessStrip } from "@/components/messaging/ReadinessStrip";
import { useMessagingOverview, type Campaign } from "@/components/messaging/useMessaging";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Column, Table } from "@/components/ui/Table";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useAdminList } from "@/lib/useAdminList";
import { useAdminMe } from "@/lib/useAdminMe";

export default function MessagingPage() {
  return (
    <Suspense fallback={<AdminShell><TableSkeleton columns={5} /></AdminShell>}>
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
        <Link href={`/messaging/${c.id}`} className="group block min-w-0">
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
    <AdminShell>
      <PageHeader
        title="Announcements"
        description="Notify everyone, a group, or specific people — in-app, by push and by email."
        actions={
          can("campaigns.send") && (
            <>
              <Link
                href="/messaging/new?kind=direct"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Send aria-hidden className="h-4 w-4" /> Message people
              </Link>
              <Link
                href="/messaging/new"
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Megaphone aria-hidden className="h-4 w-4" /> New announcement
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
            { value: "announcement", label: "Announcements" },
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

      {overview.data && <DeliveryEngine jobs={overview.data.jobs} canManage={can("channels.manage")} onChanged={() => overview.mutate()} />}
    </AdminShell>
  );
}

function DeliveryEngine({
  jobs,
  canManage,
  onChanged,
}: {
  jobs: NonNullable<ReturnType<typeof useMessagingOverview>["data"]>["jobs"];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState(jobs.dispatch_url ?? jobs.suggested_url);
  const [busy, setBusy] = useState(false);
  const healthy = jobs.health.pg_net && jobs.health.pg_cron && jobs.health.dispatch_job_scheduled;

  async function save(enabled: boolean) {
    setBusy(true);
    try {
      await adminApi.PUT("/messaging/jobs", { body: { enabled, dispatch_url: url.trim() || null } }).then(unwrap);
      toast.success(enabled ? "Background sending is on." : "Background sending is off.");
      onChanged();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not save."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="delivery" className="mt-8 scroll-mt-20">
      <Card
        title="Delivery engine"
        description="Small messages go out the moment you press Send. Large audiences and scheduled messages are worked through in the background, every minute, by the database scheduler calling the backend."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Switch
              checked={jobs.enabled}
              disabled={!canManage || busy || !healthy}
              onChange={(v) => save(v)}
              label={jobs.enabled ? "Background sending is on" : "Background sending is off"}
              description={
                healthy
                  ? "Needed for scheduled messages and for very large audiences."
                  : "The database is missing a required extension (pg_net / pg_cron) — see the checks."
              }
            />
            <TextField
              label="Backend dispatch URL"
              value={url}
              disabled={!canManage}
              onChange={(e) => setUrl(e.target.value)}
              hint="The backend's public address + /v1/internal/jobs/dispatch. Pre-filled with this backend's own URL."
            />
            {canManage && url !== (jobs.dispatch_url ?? "") && (
              <Button size="sm" disabled={busy} onClick={() => save(jobs.enabled)}>
                Save URL
              </Button>
            )}
          </div>
          <dl className="space-y-1.5 text-sm">
            {[
              ["pg_net extension", jobs.health.pg_net],
              ["pg_cron extension", jobs.health.pg_cron],
              ["Every-minute dispatch job", jobs.health.dispatch_job_scheduled],
            ].map(([label, ok]) => (
              <div key={String(label)} className="flex justify-between gap-2">
                <dt className="text-slate-500">{label}</dt>
                <dd>{ok ? <Badge tone="success">ok</Badge> : <Badge tone="danger">missing</Badge>}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Last run</dt>
              <dd className="text-slate-800">
                {jobs.last_run_at ? `${relativeTime(jobs.last_run_at)} · ${jobs.last_run_ok ? "ok" : "failed"}` : "never"}
              </dd>
            </div>
          </dl>
        </div>
      </Card>
    </div>
  );
}
