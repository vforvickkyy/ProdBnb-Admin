"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { useMessagingOverview } from "@/components/messaging/useMessaging";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { extractErrorMessage } from "@/components/ui/ErrorState";
import { TextField } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { adminApi, unwrap } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export function DeliveryEngine({
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
    <div id="delivery" className="scroll-mt-20">
      <Card
        title="Delivery engine"
        description="Small messages go out the moment you press Send. Large audiences, scheduled campaigns, email retries and the day-before booking reminders are worked through in the background, every minute, by the database scheduler calling the backend."
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
