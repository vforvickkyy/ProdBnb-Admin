"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, CalendarCheck, CircleAlert, CreditCard, ShieldCheck, Timer, UserCog } from "lucide-react";
import { BarList } from "@/components/charts/BarList";
import { MetricChart, type Metric } from "@/components/charts/MetricChart";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCount, formatDateTime, formatMoney, humanize } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type DashboardSummary = components["schemas"]["DashboardSummary"];
type Analytics = components["schemas"]["Analytics"];
type Range = "7d" | "30d" | "90d";

const RANGES: { value: Range; label: string; days: number; bucket: "day" | "week" }[] = [
  { value: "7d", label: "7 days", days: 7, bucket: "day" },
  { value: "30d", label: "30 days", days: 30, bucket: "day" },
  { value: "90d", label: "90 days", days: 90, bucket: "week" },
];

const DAY = 86_400_000;

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

/** Previous-period values lined up with the current period's buckets (same length, oldest first). */
function aligned(previous: number[], length: number): number[] {
  const tail = previous.slice(-length);
  return [...Array.from({ length: Math.max(0, length - tail.length) }, () => 0), ...tail];
}

function shortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : formatDateTime(iso);
}

function useAnalytics(enabled: boolean, days: number, bucket: string, offsetDays: number) {
  // Rounded to the minute so the SWR key is stable across re-renders.
  const { from, to } = useMemo(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    const end = now.getTime() - offsetDays * DAY;
    return { from: new Date(end - days * DAY).toISOString(), to: new Date(end).toISOString() };
  }, [days, offsetDays]);
  return useSWR(
    enabled ? `/v1/admin/analytics?from=${from}&to=${to}&bucket=${bucket}` : null,
    () => adminApi.GET("/analytics", { params: { query: { from, to, bucket: bucket as "day", tz: "Asia/Kolkata" } } }).then(unwrap<Analytics>),
    { keepPreviousData: true },
  );
}

function PillTabs<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return <Segmented label={label} value={value} options={options} onChange={onChange} />;
}

function NeedsAttention({ summary, canPayments }: { summary: DashboardSummary; canPayments: boolean }) {
  const rows = [
    {
      label: "Listings awaiting approval",
      value: summary.locations_awaiting_approval,
      href: "/moderation",
      icon: ShieldCheck,
      clear: "Moderation queue is clear",
    },
    {
      label: "Unpaid holds",
      value: summary.unpaid_holds,
      href: "/bookings?payment_state=unpaid_hold",
      icon: Timer,
      clear: "No slots held without payment",
    },
    {
      label: "Payments needing attention",
      value: summary.payments_needing_attention,
      href: canPayments ? "/payments?view=attention" : undefined,
      icon: CreditCard,
      clear: "Nothing owed back",
    },
  ];
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
        <span className={cn("flex items-center gap-1.5 text-xs", total > 0 ? "text-amber-700" : "text-green-700")}>
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", total > 0 ? "animate-pulse bg-amber-500" : "bg-green-500")} />
          {total > 0 ? "Action needed" : "All clear"}
        </span>
      </div>
      <div className="mt-3 text-[40px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">{formatCount(total)}</div>
      <p className="mt-1.5 text-xs text-slate-500">open items across moderation, bookings and payments</p>
      <ul className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
        {rows.map((row) => {
          const Icon = row.icon;
          const content = (
            <>
              <Icon aria-hidden className={cn("h-4 w-4 shrink-0", row.value > 0 ? "text-amber-600" : "text-slate-400")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-slate-800">{row.label}</span>
                {row.value === 0 && <span className="block text-xs text-slate-500">{row.clear}</span>}
              </span>
              <span className={cn("text-sm font-semibold tabular-nums", row.value > 0 ? "text-slate-900" : "text-slate-400")}>{formatCount(row.value)}</span>
              {row.href && <ArrowRight aria-hidden className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5" />}
            </>
          );
          return (
            <li key={row.label}>
              {row.href ? (
                <Link href={row.href} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50">
                  {content}
                </Link>
              ) : (
                <div className="flex items-center gap-3 py-2.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RecentActivity({ summary }: { summary: DashboardSummary }) {
  const events = [
    ...summary.recent_bookings.map((b) => ({
      id: `b-${b.id}`,
      at: b.created_at,
      icon: CalendarCheck,
      title: `Booking for ${formatDateTime(b.start_at)}`,
      meta: <StatusBadge status={b.status} />,
      href: `/bookings/${b.id}`,
    })),
    ...summary.recent_admin_actions.map((a) => ({
      id: `a-${a.id}`,
      at: a.created_at,
      icon: UserCog,
      title: humanize(a.action.replace(/^ADMIN_/, "")),
      meta: <span className="text-xs text-slate-500">{a.target_type.replace(/_/g, " ")}</span>,
      href: undefined as string | undefined,
    })),
  ]
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 8);

  return (
    <Card
      title="Recent activity"
      actions={
        <Link href="/audit-log" className="text-xs text-slate-500 hover:text-slate-900">
          View all
        </Link>
      }
    >
      {events.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Nothing has happened yet.</p>
      ) : (
        <ol className="relative space-y-0.5">
          {events.map((event) => {
            const Icon = event.icon;
            const body = (
              <>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                  <Icon aria-hidden className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-800">{event.title}</span>
                  <span className="mt-0.5 flex items-center gap-2">{event.meta}</span>
                </span>
                <time dateTime={event.at} className="shrink-0 pt-0.5 text-xs text-slate-400" title={formatDateTime(event.at)}>
                  {timeAgo(event.at)}
                </time>
              </>
            );
            return (
              <li key={event.id}>
                {event.href ? (
                  <Link href={event.href} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function MarketplaceFigures({ summary, canPayments }: { summary: DashboardSummary; canPayments: boolean }) {
  const rows: { label: string; value: string; href?: string; hint?: string }[] = [
    { label: "Total users", value: formatCount(summary.total_users), href: "/users" },
    { label: "Active hosts", value: formatCount(summary.active_hosts), href: "/hosts" },
    { label: "Published listings", value: formatCount(summary.published_locations), href: "/locations?status=published" },
    { label: "Upcoming bookings", value: formatCount(summary.upcoming_bookings), href: "/bookings" },
    {
      label: "Payments, 30 days",
      value: formatMoney(summary.payment_activity_30d.total_amount_minor_units, "INR", { compact: true }),
      hint: `${formatCount(summary.payment_activity_30d.count)} paid`,
      href: canPayments ? "/payments" : undefined,
    },
    {
      label: "Refunds, 30 days",
      value: formatMoney(summary.refund_activity_30d.total_amount_minor_units, "INR", { compact: true }),
      hint: `${formatCount(summary.refund_activity_30d.count)} refunds`,
      href: canPayments ? "/payments/refunds" : undefined,
    },
  ];
  return (
    <Card title="Marketplace">
      <ul className="-my-1 divide-y divide-slate-200">
        {rows.map((row) => {
          const inner = (
            <>
              <span className="flex-1 text-[13px] text-slate-600">{row.label}</span>
              {row.hint && <span className="text-xs text-slate-400">{row.hint}</span>}
              <span className="w-20 text-right text-sm font-semibold text-slate-900 tabular-nums">{row.value}</span>
            </>
          );
          return (
            <li key={row.label}>
              {row.href ? (
                // The visible label is part of the accessible name (e.g. "Total users 1,204").
                <Link href={row.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50">
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-3 py-2.5">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function DashboardPage() {
  const { me, can } = useAdminMe();
  const canAnalytics = can("analytics.view");
  const canPayments = can("payments.view");
  const [range, setRange] = useState<Range>("30d");
  const [metric, setMetric] = useState("gmv");
  const [placesTab, setPlacesTab] = useState<"cities" | "listings">("cities");
  const [breakdownTab, setBreakdownTab] = useState<"status" | "type">("status");
  const preset = RANGES.find((r) => r.value === range)!;

  const { data: summary, error, isLoading, mutate } = useSWR("/v1/admin/dashboard", () => adminApi.GET("/dashboard").then(unwrap<DashboardSummary>));
  const current = useAnalytics(canAnalytics, preset.days, preset.bucket, 0);
  const previous = useAnalytics(canAnalytics, preset.days, preset.bucket, preset.days);

  const metrics = useMemo<Metric[]>(() => {
    const cur = current.data;
    if (!cur) return [];
    const prev = previous.data;
    const n = cur.series.length;
    const pick = (key: "gmv_minor" | "bookings_created" | "bookings_paid" | "new_users") => ({
      current: cur.series.map((s) => s[key]),
      previous: prev ? aligned(prev.series.map((s) => s[key]), n) : undefined,
    });
    const money = (v: number) => formatMoney(v, "INR", { compact: true });
    const count = (v: number) => formatCount(v, { compact: true });
    return [
      { key: "gmv", label: "Booking value", value: money(cur.totals.gmv_minor), delta: prev ? change(cur.totals.gmv_minor, prev.totals.gmv_minor) : null, formatValue: money, ...pick("gmv_minor") },
      { key: "bookings", label: "Bookings", value: formatCount(cur.totals.bookings_created), delta: prev ? change(cur.totals.bookings_created, prev.totals.bookings_created) : null, formatValue: count, ...pick("bookings_created") },
      { key: "paid", label: "Paid bookings", value: formatCount(cur.totals.bookings_paid), delta: prev ? change(cur.totals.bookings_paid, prev.totals.bookings_paid) : null, formatValue: count, ...pick("bookings_paid") },
      { key: "users", label: "New users", value: formatCount(cur.totals.new_users), delta: prev ? change(cur.totals.new_users, prev.totals.new_users) : null, formatValue: count, ...pick("new_users") },
    ];
  }, [current.data, previous.data]);

  const greeting = me?.first_name ? `Welcome back, ${me.first_name}. ` : "";
  const analytics = current.data;

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${greeting}How the marketplace is doing, and what needs you right now.`}
        actions={canAnalytics && <Segmented label="Date range" value={range} options={RANGES} onChange={setRange} />}
      />

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-3" role="status" aria-label="Loading">
          <Skeleton className="h-[380px] w-full rounded-xl lg:col-span-2" />
          <Skeleton className="h-[380px] w-full rounded-xl" />
        </div>
      ) : error || !summary ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load the overview.")} onRetry={() => mutate()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            {canAnalytics ? (
              current.error ? (
                <ErrorState message={extractErrorMessage(current.error, "Failed to load the figures.")} onRetry={() => current.mutate()} />
              ) : metrics.length === 0 || !analytics ? (
                <Skeleton className="h-[380px] w-full rounded-xl" />
              ) : (
                <>
                  <MetricChart
                    metrics={metrics}
                    selected={metric}
                    onSelect={setMetric}
                    labels={analytics.series.map((s) => s.bucket_start)}
                    formatLabel={shortDate}
                    loading={current.isValidating || previous.isValidating}
                    toolbar={
                      <p className="text-xs text-slate-500">
                        Last {preset.label}, by {preset.bucket}, against the {preset.label} before · IST · INR
                      </p>
                    }
                  />
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card
                      title="Top places"
                      actions={
                        <PillTabs
                          label="Top places by"
                          value={placesTab}
                          onChange={setPlacesTab}
                          options={[
                            { value: "cities", label: "Cities" },
                            { value: "listings", label: "Listings" },
                          ]}
                        />
                      }
                    >
                      {placesTab === "cities" ? (
                        <BarList valueHeader="Bookings" formatValue={(v) => formatCount(v)} rows={analytics.top_cities.map((c) => ({ label: c.city, value: c.bookings }))} />
                      ) : (
                        <BarList
                          valueHeader="Value"
                          formatValue={(v) => formatMoney(v, "INR", { compact: true })}
                          emptyText="No paid bookings in this range."
                          rows={analytics.top_locations.map((l) => ({ label: l.title, value: l.gmv_minor, href: `/locations/${l.id}`, hint: l.city }))}
                        />
                      )}
                    </Card>
                    <Card
                      title="Bookings"
                      actions={
                        <PillTabs
                          label="Bookings by"
                          value={breakdownTab}
                          onChange={setBreakdownTab}
                          options={[
                            { value: "status", label: "Status" },
                            { value: "type", label: "Type" },
                          ]}
                        />
                      }
                    >
                      <BarList
                        valueHeader="Bookings"
                        formatValue={(v) => formatCount(v)}
                        rows={Object.entries(breakdownTab === "status" ? analytics.status_breakdown : analytics.booking_type_breakdown)
                          .map(([label, value]) => ({ label: humanize(label), value }))
                          .sort((a, b) => b.value - a.value)}
                      />
                    </Card>
                  </div>
                </>
              )
            ) : (
              <MarketplaceFigures summary={summary} canPayments={canPayments} />
            )}
          </div>
          <div className="min-w-0 space-y-6">
            <NeedsAttention summary={summary} canPayments={canPayments} />
            <RecentActivity summary={summary} />
            {canAnalytics && <MarketplaceFigures summary={summary} canPayments={canPayments} />}
            {summary.payments_needing_attention > 0 && !canPayments && (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <CircleAlert aria-hidden className="h-3.5 w-3.5" /> Some payments need a finance admin&apos;s attention.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
