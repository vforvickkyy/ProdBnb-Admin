"use client";

import Link from "next/link";
import useSWR from "swr";
import { AdminShell } from "@/components/AdminShell";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { adminApi, unwrap } from "@/lib/api";
import { formatCount, formatDateTime, formatMoney, humanize } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type DashboardSummary = components["schemas"]["DashboardSummary"];

export default function DashboardPage() {
  const { me, can } = useAdminMe();
  const { data: summary, error, isLoading, mutate } = useSWR("/v1/admin/dashboard", () =>
    adminApi.GET("/dashboard").then(unwrap<DashboardSummary>)
  );

  const greeting = me?.first_name ? `Welcome back, ${me.first_name}. ` : "";

  return (
    <AdminShell>
      <PageHeader title="Dashboard" description={`${greeting}What needs attention across the marketplace right now.`} />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-label="Loading">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : error || !summary ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load the dashboard.")} onRetry={() => mutate()} />
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Needs action</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile
                label="Listings awaiting approval"
                value={formatCount(summary.locations_awaiting_approval)}
                href="/moderation"
                tone={summary.locations_awaiting_approval > 0 ? "attention" : "default"}
                hint={summary.locations_awaiting_approval > 0 ? "Review in the moderation queue" : "Queue is clear"}
              />
              <StatTile
                label="Unpaid holds"
                value={formatCount(summary.unpaid_holds)}
                href="/bookings?payment_state=unpaid_hold"
                tone={summary.unpaid_holds > 0 ? "attention" : "default"}
                hint={summary.unpaid_holds > 0 ? "Bookings holding a slot with no payment" : "No unpaid holds"}
              />
              <StatTile
                label="Payments needing attention"
                value={formatCount(summary.payments_needing_attention)}
                href={can("payments.view") ? "/payments?view=attention" : undefined}
                tone={summary.payments_needing_attention > 0 ? "attention" : "default"}
                hint={summary.payments_needing_attention > 0 ? "Paid, but the booking was cancelled or rejected" : "Nothing owed"}
              />
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Marketplace</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile label="Total users" value={formatCount(summary.total_users)} href="/users" />
              <StatTile label="Active hosts" value={formatCount(summary.active_hosts)} href="/hosts" />
              <StatTile label="Published listings" value={formatCount(summary.published_locations)} href="/locations?status=published" />
              <StatTile label="Upcoming bookings" value={formatCount(summary.upcoming_bookings)} href="/bookings" />
              <StatTile
                label="Payments, last 30 days"
                value={formatMoney(summary.payment_activity_30d.total_amount_minor_units, "INR", { compact: true })}
                hint={`${formatCount(summary.payment_activity_30d.count)} successful payments`}
                href={can("payments.view") ? "/payments" : undefined}
              />
              <StatTile
                label="Refunds, last 30 days"
                value={formatMoney(summary.refund_activity_30d.total_amount_minor_units, "INR", { compact: true })}
                hint={`${formatCount(summary.refund_activity_30d.count)} refunds`}
                href={can("payments.view") ? "/payments/refunds" : undefined}
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Latest bookings" actions={<Link href="/bookings" className="text-sm text-slate-500 underline hover:text-slate-800">All bookings</Link>}>
              {summary.recent_bookings.length === 0 ? (
                <EmptyState title="No bookings yet." />
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {summary.recent_bookings.map((b) => (
                    <li key={b.id}>
                      <Link href={`/bookings/${b.id}`} className="flex items-center justify-between gap-3 py-2 hover:bg-slate-50">
                        <span className="text-slate-700">
                          Shoot {formatDateTime(b.start_at)}
                          <span className="block text-xs text-slate-400">Booked {formatDateTime(b.created_at)}</span>
                        </span>
                        <StatusBadge status={b.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Recent admin actions" actions={<Link href="/audit-log" className="text-sm text-slate-500 underline hover:text-slate-800">Audit log</Link>}>
              {summary.recent_admin_actions.length === 0 ? (
                <EmptyState title="No admin actions yet." />
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {summary.recent_admin_actions.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-slate-700">
                        {humanize(a.action.replace(/^ADMIN_/, ""))}
                        <span className="block text-xs text-slate-400">{a.target_type.replace(/_/g, " ")}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">{formatDateTime(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
