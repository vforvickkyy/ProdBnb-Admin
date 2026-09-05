"use client";

import Link from "next/link";
import useSWR from "swr";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import type { components } from "@/types/admin-api";

type DashboardSummary = components["schemas"]["DashboardSummary"];

function formatAmount(minorUnits: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minorUnits / 100);
}

export default function DashboardPage() {
  const { data: summary, error, isLoading, mutate } = useSWR("/v1/admin/dashboard", () =>
    adminApi.GET("/dashboard").then(unwrap<DashboardSummary>)
  );

  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : error || !summary ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load the dashboard.")} onRetry={() => mutate()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Total users" value={summary.total_users} href="/users" />
            <Stat label="Active hosts" value={summary.active_hosts} href="/users?role=host" />
            <Stat label="Published locations" value={summary.published_locations} href="/locations?status=published" />
            <Stat label="Awaiting approval" value={summary.locations_awaiting_approval} href="/moderation" highlight={summary.locations_awaiting_approval > 0} />
            <Stat label="Upcoming bookings" value={summary.upcoming_bookings} href="/bookings" />
            <Stat label="Payments (30d)" value={`${summary.payment_activity_30d.count} · ${formatAmount(summary.payment_activity_30d.total_amount_minor_units)}`} href="/payments" />
            <Stat label="Refunds (30d)" value={`${summary.refund_activity_30d.count} · ${formatAmount(summary.refund_activity_30d.total_amount_minor_units)}`} href="/payments/refunds" />
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Recent admin actions</h2>
            {summary.recent_admin_actions.length === 0 ? (
              <EmptyState title="No recent admin actions." />
            ) : (
              <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
                {summary.recent_admin_actions.map((a) => (
                  <li key={a.id} className="px-4 py-2 text-sm text-slate-600">
                    {a.action.replace(/_/g, " ").toLowerCase()} — {a.target_type} — {new Date(a.created_at).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/audit-log" className="mt-2 inline-block text-sm text-slate-500 underline hover:text-slate-800">
              View full audit log →
            </Link>
          </div>
        </>
      )}
    </AdminShell>
  );
}

function Stat({ label, value, href, highlight }: { label: string; value: number | string; href: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded border p-4 transition-colors hover:bg-slate-50 ${highlight ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}
    >
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </Link>
  );
}
