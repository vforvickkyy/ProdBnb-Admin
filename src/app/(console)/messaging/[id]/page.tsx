"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { audienceLabel, CAMPAIGN_TONE, ChannelIcons } from "@/components/messaging/campaignDisplay";
import type { Campaign } from "@/components/messaging/useMessaging";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, KeyValues } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { Column, Table } from "@/components/ui/Table";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { renderEmailPreview } from "@/lib/emailPreview";
import { formatCount, formatDateTime, personName } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Recipient = components["schemas"]["CampaignRecipient"];

export default function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useAdminMe();
  const canSend = can("campaigns.send");
  const { data, error, isLoading, mutate } = useSWR(`/v1/admin/campaigns/${id}`, () =>
    adminApi.GET("/campaigns/{campaignId}", { params: { path: { campaignId: id } } }).then(unwrap<Campaign>)
  );
  const [confirm, setConfirm] = useState<"cancel" | "delete" | "send" | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "failed" | "pending">("all");
  const [page, setPage] = useState(1);
  const recipients = useSWR(data && data.status !== "draft" ? `/v1/admin/campaigns/${id}/recipients?f=${filter}&p=${page}` : null, () =>
    adminApi
      .GET("/campaigns/{campaignId}/recipients", { params: { path: { campaignId: id }, query: { filter, page, pageSize: 20 } } })
      .then(unwrapPaginated<Recipient>)
  );

  // While sending and this page is open, keep advancing it (the background dispatcher does the same
  // every minute when enabled) and refresh the numbers.
  const processing = useRef(false);
  useEffect(() => {
    if (data?.status !== "sending" || !canSend) return;
    const timer = window.setInterval(async () => {
      if (processing.current) return;
      processing.current = true;
      try {
        const next = await adminApi.POST("/campaigns/{campaignId}/process", { params: { path: { campaignId: id } } }).then(unwrap<Campaign>);
        await mutate(next, { revalidate: false });
        void recipients.mutate();
      } catch {
        // transient; next tick retries
      } finally {
        processing.current = false;
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [data?.status, id, canSend, mutate, recipients]);

  async function run() {
    setBusy(true);
    try {
      if (confirm === "cancel") {
        await mutate(await adminApi.POST("/campaigns/{campaignId}/cancel", { params: { path: { campaignId: id } } }).then(unwrap<Campaign>), { revalidate: false });
        toast.success("Stopped. Anyone not yet reached will not receive it.");
      } else if (confirm === "delete") {
        await adminApi.DELETE("/campaigns/{campaignId}", { params: { path: { campaignId: id } } }).then(unwrap);
        toast.success("Draft deleted.");
        router.push("/messaging");
        return;
      } else if (confirm === "send") {
        await mutate(await adminApi.POST("/campaigns/{campaignId}/send", { params: { path: { campaignId: id } }, body: {} }).then(unwrap<Campaign>), {
          revalidate: false,
        });
        toast.success("Sending.");
      }
      setConfirm(null);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Action failed."));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-96 w-full" />
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <ErrorState message={extractErrorMessage(error, "Failed to load.")} onRetry={() => mutate()} />
      </>
    );
  }

  const s = data.stats;
  const progress = s.total ? s.processed / s.total : 0;
  const columns: Column<Recipient>[] = [
    {
      key: "who",
      header: "Recipient",
      render: (r) => (
        <Link href={`/users/${r.user_id}`} className="block min-w-0 hover:underline">
          <span className="block truncate text-slate-900">{personName(r)}</span>
          <span className="block truncate text-xs text-slate-500">{r.email ?? "no email"}</span>
        </Link>
      ),
    },
    ...(data.channels.includes("in_app") ? [{ key: "inapp", header: "In-app", render: (r: Recipient) => <StatusBadge status={r.in_app_status} /> }] : []),
    ...(data.channels.includes("push")
      ? [
          {
            key: "push",
            header: "Push",
            render: (r: Recipient) => (
              <span className="flex items-center gap-1.5">
                <StatusBadge status={r.push_status} />
                {r.push_sent + r.push_failed > 0 && <span className="text-xs text-slate-500">{r.push_sent}/{r.push_sent + r.push_failed}</span>}
              </span>
            ),
          },
        ]
      : []),
    ...(data.channels.includes("email") ? [{ key: "email", header: "Email", render: (r: Recipient) => <StatusBadge status={r.email_status} /> }] : []),
    { key: "error", header: "Note", className: "max-w-xs", render: (r) => <span className="line-clamp-2 text-xs text-red-700">{r.error ?? ""}</span> },
  ];

  return (
    <>
      <Link href="/messaging" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Announcements
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-slate-900">{data.name}</h1>
            <Badge tone={CAMPAIGN_TONE[data.status] ?? "neutral"}>{data.status}</Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {data.kind === "direct" ? "Direct message" : "Announcement"} · {audienceLabel(data.audience)} · <ChannelIcons channels={data.channels} />
            {data.channels.includes("push") && <span>({data.platforms.join(", ")})</span>}
          </p>
        </div>
        {canSend && (
          <div className="flex flex-wrap gap-2">
            {data.status === "draft" && (
              <>
                <Link
                  href={`/messaging/new?draft=${id}`}
                  className="inline-flex items-center h-8 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 shadow-card transition-colors hover:bg-slate-50"
                >
                  Edit
                </Link>
                <Button variant="brand" onClick={() => setConfirm("send")}>
                  Send now
                </Button>
                <Button variant="ghost" onClick={() => setConfirm("delete")}>
                  Delete
                </Button>
              </>
            )}
            {(data.status === "scheduled" || data.status === "sending") && (
              <Button variant="danger" onClick={() => setConfirm("cancel")}>
                {data.status === "scheduled" ? "Cancel schedule" : "Stop sending"}
              </Button>
            )}
          </div>
        )}
      </div>

      {data.status !== "draft" && (
        <>
          {(data.status === "sending" || data.status === "sent") && s.total > 0 && (
            <div className="mb-4" aria-live="polite">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>{data.status === "sending" ? "Sending…" : "Complete"}</span>
                <span>
                  {formatCount(s.processed)} / {formatCount(s.total)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-accent-500 transition-[width] duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            </div>
          )}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Recipients" value={formatCount(s.total)} />
            {data.channels.includes("in_app") && <StatTile label="In-app delivered" value={formatCount(s.in_app_created)} />}
            {data.channels.includes("push") && (
              <StatTile label="Push sent" value={formatCount(s.push_sent)} hint={`${s.push_failed} failed · ${s.push_no_devices} no device · ${s.push_opted_out} opted out`} />
            )}
            {data.channels.includes("email") && (
              <StatTile label="Emails sent" value={formatCount(s.email_sent)} hint={`${s.email_failed} failed · ${s.email_unsubscribed} unsubscribed`} />
            )}
          </div>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {data.status !== "draft" && (
            <Card
              title="Recipients"
              actions={
                <Segmented
                  label="Filter recipients"
                  value={filter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "failed", label: "Failed" },
                    { value: "pending", label: "Pending" },
                  ]}
                  onChange={(v) => {
                    setFilter(v);
                    setPage(1);
                  }}
                />
              }
            >
              {recipients.isLoading ? (
                <TableSkeleton columns={4} rows={4} />
              ) : (recipients.data?.data ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">Nobody here.</p>
              ) : (
                <>
                  <Table columns={columns} rows={recipients.data!.data} rowKey={(r) => r.user_id} caption="Recipients" />
                  {recipients.data!.meta.total > 20 && (
                    <Pagination page={page} pageSize={20} total={recipients.data!.meta.total} onPageChange={setPage} label="Recipients" />
                  )}
                </>
              )}
            </Card>
          )}
          <Card title="Content">
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notification</p>
                <p className="mt-1 font-semibold text-slate-900">{data.title}</p>
                <p className="whitespace-pre-line text-slate-700">{data.body}</p>
                {data.link_url && <p className="mt-1 break-all text-xs text-slate-500">Opens {data.link_url}</p>}
              </div>
              {data.email_subject && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Email · {data.email_subject}</p>
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-4 text-slate-800" dangerouslySetInnerHTML={{ __html: renderEmailPreview(data.email_body ?? "") }} />
                </div>
              )}
            </div>
          </Card>
        </div>
        <Card title="Timeline">
          <KeyValues
            items={[
              { label: "Created", value: formatDateTime(data.created_at) },
              { label: "Scheduled for", value: data.scheduled_at ? formatDateTime(data.scheduled_at) : "—" },
              { label: "Started", value: formatDateTime(data.started_at) },
              { label: "Finished", value: formatDateTime(data.completed_at) },
              ...(data.last_error ? [{ label: "Error", value: <span className="text-red-700">{data.last_error}</span> }] : []),
            ]}
          />
        </Card>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "delete" ? "Delete this draft?" : confirm === "send" ? "Send it now?" : "Stop this message?"}
        description={
          confirm === "send"
            ? `It goes to ${audienceLabel(data.audience).toLowerCase()} straight away.`
            : confirm === "cancel"
              ? "People already reached keep it. Nobody else will receive it."
              : "This cannot be undone."
        }
        danger={confirm !== "send"}
        busy={busy}
        confirmLabel={confirm === "delete" ? "Delete" : confirm === "send" ? "Send now" : "Stop"}
        onConfirm={run}
      />
    </>
  );
}
