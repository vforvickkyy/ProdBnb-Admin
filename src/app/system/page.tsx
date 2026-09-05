"use client";

import useSWR from "swr";
import { AdminShell } from "@/components/AdminShell";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { getReadiness } from "@/lib/health";
import type { components } from "@/types/admin-api";

type SystemStatus = components["schemas"]["SystemStatus"];

// Local, explicit tones for this page only -- these values (readiness,
// "disabled" as a valid config, "not configured") aren't resource statuses
// like "published"/"suspended", so they deliberately don't go in the shared
// StatusBadge lookup table.
function Field({ label, tone, children }: { label: string; tone: BadgeTone; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <Badge tone={tone}>{children}</Badge>
    </div>
  );
}

export default function SystemHealthPage() {
  const { data: status, error: statusError, isLoading: statusLoading, mutate: retryStatus } = useSWR("/v1/admin/system/status", () =>
    adminApi.GET("/system/status").then(unwrap<SystemStatus>)
  );
  const { data: readiness, isLoading: readinessLoading } = useSWR("/health/ready", getReadiness);

  return (
    <AdminShell>
      <h1 className="mb-6 text-xl font-semibold">System Health</h1>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Backend</h2>
          {readinessLoading ? (
            <Skeleton className="h-6 w-32" />
          ) : (
            <Field label="Readiness" tone={readiness === "ready" ? "success" : "danger"}>
              {readiness === "ready" ? "Ready" : "Not Ready"}
            </Field>
          )}
        </section>

        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Configuration</h2>
          {statusLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : statusError || !status ? (
            <ErrorState message={extractErrorMessage(statusError, "Failed to load system status.")} onRetry={() => retryStatus()} />
          ) : (
            <>
              <Field label="Environment" tone="info">
                {status.environment}
              </Field>
              <Field label="Payment provider" tone="info">
                {status.payments.provider}
              </Field>
              <Field label="Payment mode" tone={status.payments.mode === "test" ? "warning" : "success"}>
                {status.payments.mode}
              </Field>
              <Field label="Notification provider" tone={status.notifications.provider === "disabled" ? "neutral" : "success"}>
                {status.notifications.provider === "disabled" ? "Disabled" : status.notifications.provider}
              </Field>
              <Field label="Media (R2)" tone={status.media.configured ? "success" : "neutral"}>
                {status.media.configured ? "Configured" : "Not configured"}
              </Field>
            </>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
