"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi } from "@/lib/api";

// The response shape is `{ data: unknown }` in the OpenAPI contract (the
// generator doesn't infer this backend's actual field-level response
// shapes from a zod schema, only request shapes) -- cast narrowly to what
// dashboard.service.ts on the backend actually returns, documented in
// docs/DATABASE.md's Phase 11 section.
interface DashboardSummary {
  total_users: number;
  active_hosts: number;
  published_locations: number;
  locations_awaiting_approval: number;
  upcoming_bookings: number;
  payment_activity_30d: { count: number; total_amount_minor_units: number };
  refund_activity_30d: { count: number; total_amount_minor_units: number };
  recent_admin_actions: { id: string; action: string; target_type: string; created_at: string }[];
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error: apiError } = await adminApi.GET("/dashboard");
      if (apiError) {
        setError("Failed to load dashboard.");
        return;
      }
      setSummary((data as { data: DashboardSummary }).data);
    }
    load();
  }, []);

  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>
      {error && <p className="text-red-700">{error}</p>}
      {!summary && !error && <p className="text-slate-500">Loading…</p>}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Total users" value={summary.total_users} />
          <Stat label="Active hosts" value={summary.active_hosts} />
          <Stat label="Published locations" value={summary.published_locations} />
          <Stat label="Awaiting approval" value={summary.locations_awaiting_approval} />
          <Stat label="Upcoming bookings" value={summary.upcoming_bookings} />
          <Stat label="Payments (30d)" value={summary.payment_activity_30d.count} />
          <Stat label="Refunds (30d)" value={summary.refund_activity_30d.count} />
        </div>
      )}
      {summary && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Recent admin actions</h2>
          <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
            {summary.recent_admin_actions.map((a) => (
              <li key={a.id} className="px-4 py-2 text-sm text-slate-600">
                {a.action} — {a.target_type} — {new Date(a.created_at).toLocaleString()}
              </li>
            ))}
            {summary.recent_admin_actions.length === 0 && <li className="px-4 py-2 text-sm text-slate-400">No recent actions.</li>}
          </ul>
        </div>
      )}
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}
