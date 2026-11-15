"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { BarList } from "@/components/charts/BarList";
import { LineChart } from "@/components/charts/LineChart";
import { Card } from "@/components/ui/Card";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { adminApi, unwrap } from "@/lib/api";
import { formatCount, formatMoney, formatPercent, humanize } from "@/lib/format";
import type { components } from "@/types/admin-api";

type Analytics = components["schemas"]["Analytics"];
type Range = "7d" | "30d" | "90d" | "12m";
type Bucket = "day" | "week" | "month";

// Categorical slots 1-2 of the reference palette, validated on the console's white card surface
// (dataviz validate_palette.js: all checks pass, worst adjacent CVD ΔE 24.7).
const SERIES_1 = "var(--viz-1)";
const SERIES_2 = "var(--viz-2)";

const RANGES: { value: Range; label: string; days: number; bucket: Bucket }[] = [
  { value: "7d", label: "Last 7 days", days: 7, bucket: "day" },
  { value: "30d", label: "Last 30 days", days: 30, bucket: "day" },
  { value: "90d", label: "Last 90 days", days: 90, bucket: "week" },
  { value: "12m", label: "Last 12 months", days: 365, bucket: "month" },
];

function bucketLabel(bucket: Bucket) {
  return (value: string) => {
    const d = new Date(`${value}T00:00:00`);
    if (bucket === "month") return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30d");
  const preset = RANGES.find((r) => r.value === range)!;
  const [bucketOverride, setBucketOverride] = useState<Bucket | null>(null);
  const bucket = bucketOverride ?? preset.bucket;

  // Rounded to the minute so the SWR key is stable across re-renders.
  const { from, to } = useMemo(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return { from: new Date(now.getTime() - preset.days * 86_400_000).toISOString(), to: now.toISOString() };
  }, [preset.days]);

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    `/v1/admin/analytics?from=${from}&to=${to}&bucket=${bucket}`,
    () => adminApi.GET("/analytics", { params: { query: { from, to, bucket, tz: "Asia/Kolkata" } } }).then(unwrap<Analytics>),
    { keepPreviousData: true }
  );

  const t = data?.totals;
  const labels = data?.series.map((s) => s.bucket_start) ?? [];


  return (
    <>
      <PageHeader title="Analytics" description="Bookings, money and growth across the marketplace. Times are India Standard Time; amounts are INR." />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented
          label="Date range"
          value={range}
          options={RANGES}
          onChange={(v) => {
            setRange(v);
            setBucketOverride(null);
          }}
        />
        <Segmented
          label="Group by"
          value={bucket}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
          onChange={setBucketOverride}
        />
      </div>

      {isLoading && !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-label="Loading">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : error || !data || !t ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load analytics.")} onRetry={() => mutate()} />
      ) : (
        <div className={isValidating ? "space-y-6 opacity-60 transition-opacity" : "space-y-6 transition-opacity"}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Booking value (GMV)" value={formatMoney(t.gmv_minor, "INR", { compact: true })} hint="Settled payments in range" />
            <StatTile
              label="Paid bookings"
              value={formatCount(t.bookings_paid)}
              hint={`of ${formatCount(t.bookings_created)} created (${t.bookings_created ? formatPercent(t.bookings_paid / t.bookings_created, 0) : "—"})`}
            />
            <StatTile label="Payment success rate" value={formatPercent(t.payment_success_rate)} hint="Settled ÷ finished payment attempts" />
            <StatTile label="Platform fees" value={formatMoney(t.platform_fee_minor, "INR", { compact: true })} hint="On paid bookings in range" />
            <StatTile label="New users" value={formatCount(t.new_users)} />
            <StatTile label="New listings" value={formatCount(t.new_listings)} hint={`${formatCount(t.published_listings)} published now`} />
            <StatTile label="Refunds" value={formatMoney(t.refunds_minor, "INR", { compact: true })} />
            <StatTile label="Expired unpaid holds" value={formatCount(t.expired_holds)} hint={`${formatCount(t.cancellations)} cancellations in total`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <LineChart
                title="Bookings"
                labels={labels}
                formatLabel={bucketLabel(bucket)}
                formatValue={(v) => formatCount(v, { compact: true })}
                series={[
                  { key: "created", label: "Created", color: SERIES_1, values: data.series.map((s) => s.bookings_created) },
                  { key: "paid", label: "Paid", color: SERIES_2, values: data.series.map((s) => s.bookings_paid) },
                ]}
              />
            </Card>
            <Card>
              <LineChart
                title="Booking value (INR)"
                labels={labels}
                formatLabel={bucketLabel(bucket)}
                formatValue={(v) => formatMoney(v, "INR", { compact: true })}
                series={[{ key: "gmv", label: "Booking value", color: SERIES_1, values: data.series.map((s) => s.gmv_minor) }]}
              />
            </Card>
            <Card>
              <LineChart
                title="New users"
                labels={labels}
                formatLabel={bucketLabel(bucket)}
                formatValue={(v) => formatCount(v, { compact: true })}
                series={[{ key: "users", label: "New users", color: SERIES_1, values: data.series.map((s) => s.new_users) }]}
              />
            </Card>
            <Card>
              <BarList
                title="Bookings by status"
                formatValue={(v) => formatCount(v)}
                rows={Object.entries(data.status_breakdown)
                  .map(([label, value]) => ({ label: humanize(label), value }))
                  .sort((a, b) => b.value - a.value)}
              />
            </Card>
            <Card>
              <BarList
                title="Top cities by bookings"
                formatValue={(v) => formatCount(v)}
                rows={data.top_cities.map((c) => ({ label: c.city, value: c.bookings }))}
              />
            </Card>
            <Card title="Top listings by booking value">
              {data.top_locations.length === 0 ? (
                <p className="text-sm text-slate-400">No paid bookings in this range.</p>
              ) : (
                // A compact table (not the shared Table, whose 640px minimum is for full-width lists).
                <table className="w-full text-sm">
                  <caption className="sr-only">Top listings by booking value</caption>
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th scope="col" className="pb-2 font-medium">Listing</th>
                      <th scope="col" className="pb-2 text-right font-medium">Paid</th>
                      <th scope="col" className="pb-2 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {data.top_locations.map((l) => (
                      <tr key={l.id}>
                        <td className="py-1.5 pr-3">
                          <Link href={`/locations/${l.id}`} className="text-slate-800 hover:underline">
                            {l.title}
                          </Link>
                          <span className="block text-xs text-slate-500">{l.city}</span>
                        </td>
                        <td className="py-1.5 text-right text-slate-700">{formatCount(l.paid_bookings)}</td>
                        <td className="py-1.5 pl-3 text-right text-slate-800">{formatMoney(l.gmv_minor, "INR", { compact: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          <p className="text-xs text-slate-500">
            Booking value = settled payments (success, partially or fully refunded) by payment date. Paid bookings = bookings created in
            range that have a settled payment.
            {t.other_currency_payments > 0 && ` ${t.other_currency_payments} payment attempt(s) in other currencies are excluded from INR totals.`}
          </p>
        </div>
      )}
    </>
  );
}
