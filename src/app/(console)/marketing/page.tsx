"use client";

import Link from "next/link";
import useSWR from "swr";
import { BellRing, Grid2x2, Mail, Newspaper, Star, TicketPercent, Users } from "lucide-react";
import { rate } from "@/components/messaging/CampaignList";
import { CAMPAIGN_TONE } from "@/components/messaging/campaignDisplay";
import { ReadinessStrip } from "@/components/messaging/ReadinessStrip";
import { useMessagingOverview, type Campaign } from "@/components/messaging/useMessaging";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { formatCount, relativeTime } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";

type Summary = { people: number; subscribed: number; unsubscribed: number; bounced: number; no_email: number; hosts_subscribed: number; bookers_subscribed: number };

function Tile({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-colors hover:border-slate-300">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">{body}</div>
  );
}

const STARTERS = [
  { label: "Listing spotlight", help: "One place, big photo", icon: Star, href: "/marketing/new?channel=email" },
  { label: "Listing collection", help: "A grid of places", icon: Grid2x2, href: "/marketing/new?channel=email" },
  { label: "Offer", help: "Coupon code + button", icon: TicketPercent, href: "/marketing/new?channel=email" },
  { label: "News / host tips", help: "Picture + update", icon: Newspaper, href: "/marketing/new?channel=email" },
  { label: "Push notification", help: "Phones, browsers, inbox", icon: BellRing, href: "/marketing/new?channel=push" },
];

export default function MarketingOverviewPage() {
  const { can } = useAdminMe();
  const overview = useMessagingOverview();
  const summary = useSWR("/v1/admin/email-subscribers/summary", () => adminApi.GET("/email-subscribers/summary").then(unwrap<Summary>));
  const email = useSWR("/v1/admin/campaigns?channel=email&overview", () =>
    adminApi.GET("/campaigns", { params: { query: { page: 1, pageSize: 10, kind: "announcement", channel: "email" } as never } }).then(unwrapPaginated<Campaign>),
  );
  const push = useSWR("/v1/admin/campaigns?channel=push&overview", () =>
    adminApi.GET("/campaigns", { params: { query: { page: 1, pageSize: 5, kind: "announcement", channel: "push" } as never } }).then(unwrapPaginated<Campaign>),
  );
  const sentEmail = (email.data?.data ?? []).filter((c) => c.stats.email_sent > 0);
  const totals = sentEmail.reduce((t, c) => ({ sent: t.sent + c.stats.email_sent, opened: t.opened + c.stats.email_opened, clicked: t.clicked + c.stats.email_clicked }), { sent: 0, opened: 0, clicked: 0 });
  const s = summary.data;

  return (
    <>
      <PageHeader title="Marketing" description="News and offers to your bookers and hosts, by email and push. Booking and account messages are under Messaging." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {s ? (
          <>
            <Tile label="Get news by email" value={formatCount(s.subscribed)} hint={`${formatCount(s.bookers_subscribed)} bookers · ${formatCount(s.hosts_subscribed)} hosts`} href="/marketing/subscribers?status=subscribed" />
            <Tile label="Unsubscribed" value={formatCount(s.unsubscribed)} hint={`${formatCount(s.bounced)} bounced · ${formatCount(s.no_email)} no email`} href="/marketing/subscribers?status=unsubscribed" />
          </>
        ) : (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </>
        )}
        <Tile label="Open rate (last 10 email campaigns)" value={rate(totals.opened, totals.sent)} hint={`${formatCount(totals.sent)} emails sent`} href="/marketing/email" />
        <Tile label="Click rate" value={rate(totals.clicked, totals.sent)} hint={`${formatCount(totals.clicked)} people clicked`} href="/marketing/email" />
      </div>

      {can("campaigns.send") && (
        <Card title="Start a campaign" className="mb-6">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {STARTERS.map((st) => {
              const Icon = st.icon;
              return (
                <Link key={st.label} href={st.href} className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3 transition-colors hover:border-accent-500 hover:bg-accent-50">
                  <Icon aria-hidden className="h-4 w-4 text-accent-700" />
                  <span className="text-sm font-medium text-slate-900">{st.label}</span>
                  <span className="text-xs text-slate-500">{st.help}</span>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Recent email campaigns"
          actions={
            <Link href="/marketing/email" className="text-[13px] text-slate-500 hover:text-slate-900">
              All <Mail aria-hidden className="inline h-3.5 w-3.5" />
            </Link>
          }
        >
          <CampaignRows rows={email.data?.data.slice(0, 5)} email />
        </Card>
        <Card
          title="Recent push campaigns"
          actions={
            <Link href="/marketing/push" className="text-[13px] text-slate-500 hover:text-slate-900">
              All <BellRing aria-hidden className="inline h-3.5 w-3.5" />
            </Link>
          }
        >
          <CampaignRows rows={push.data?.data} />
        </Card>
      </div>

      <div className="mt-6">{overview.data ? <ReadinessStrip overview={overview.data} /> : <Skeleton className="h-16 w-full" />}</div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
        <Users aria-hidden className="h-3.5 w-3.5" /> People who unsubscribe or whose address bounces are skipped automatically. See who is who under{" "}
        <Link href="/marketing/subscribers" className="underline">
          Subscribers
        </Link>
        .
      </p>
    </>
  );
}

function CampaignRows({ rows, email }: { rows?: Campaign[]; email?: boolean }) {
  if (!rows) return <Skeleton className="h-32 w-full" />;
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-slate-500">None yet.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`/marketing/${c.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
              <span className="block text-xs text-slate-500">{relativeTime(c.completed_at ?? c.scheduled_at ?? c.created_at)}</span>
            </span>
            {email && c.stats.email_sent > 0 && (
              <span className="text-right text-xs tabular-nums text-slate-600">
                {rate(c.stats.email_opened, c.stats.email_sent)} opened
                <br />
                {rate(c.stats.email_clicked, c.stats.email_sent)} clicked
              </span>
            )}
            <Badge tone={CAMPAIGN_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
