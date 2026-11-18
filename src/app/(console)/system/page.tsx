"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, KeyValues } from "@/components/ui/Card";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { adminPublicConfig, VERCEL_LINKS } from "@/lib/config";
import { formatDateTime } from "@/lib/format";
import { getReadiness } from "@/lib/health";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";
import { BRAND_NAME } from "@/lib/config";

type IntegrationsReport = components["schemas"]["IntegrationsReport"];
type IntegrationStatus = components["schemas"]["IntegrationStatus"];
type IntegrationSetting = components["schemas"]["IntegrationSetting"];

const STATUS: Record<IntegrationStatus["status"], { tone: BadgeTone; label: string }> = {
  ok: { tone: "success", label: "✓ Working" },
  warning: { tone: "warning", label: "! Attention" },
  error: { tone: "danger", label: "✕ Failing" },
  disabled: { tone: "neutral", label: "Off" },
  unchecked: { tone: "neutral", label: "Not checked" },
};

const KIND: Record<IntegrationSetting["kind"], string> = {
  secret: "Secret",
  identifier: "Identifier",
  public: "Public",
};

function SettingsTable({ settings }: { settings: { key: string; kind?: IntegrationSetting["kind"]; set: boolean; display: string | null }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Configuration keys</caption>
        <thead className="text-slate-500">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">Key</th>
            <th scope="col" className="py-1 pr-3 font-medium">Type</th>
            <th scope="col" className="py-1 font-medium">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {settings.map((s) => (
            <tr key={s.key}>
              <td className="py-1.5 pr-3 font-mono text-[11px] text-slate-700">{s.key}</td>
              <td className="py-1.5 pr-3 text-slate-500">{s.kind ? KIND[s.kind] : "Public"}</td>
              <td className="py-1.5 text-slate-700">
                {!s.set ? (
                  <span className="font-medium text-slate-400">Not set</span>
                ) : s.display === null ? (
                  <span className="text-slate-600">Set · hidden</span>
                ) : (
                  <span className="break-all font-mono text-[11px]">{s.display}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SystemPage() {
  const [checked, setChecked] = useState(false);
  const { data: report, error, isLoading, isValidating, mutate } = useSWR(`/v1/admin/system/integrations?check=${checked}`, () =>
    adminApi.GET("/system/integrations", { params: { query: { check: checked ? "true" : "false" } } }).then(unwrap<IntegrationsReport>)
  );
  const { data: readiness, isLoading: readinessLoading, mutate: recheckReadiness } = useSWR("/health/ready", getReadiness);
  const { can } = useAdminMe();
  const [corsBusy, setCorsBusy] = useState(false);

  async function allowBrowserUploads() {
    setCorsBusy(true);
    try {
      await adminApi.POST("/system/r2-cors").then(unwrap);
      toast.success("Browser uploads allowed. Re-running checks…");
      setChecked(true);
      await mutate();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not update the bucket."));
    } finally {
      setCorsBusy(false);
    }
  }

  function runChecks() {
    if (checked) {
      void mutate();
    } else {
      setChecked(true);
    }
    void recheckReadiness();
  }

  return (
    <>
      <PageHeader
        title="Integrations & health"
        description={`Every service ${BRAND_NAME} depends on, the keys it is configured with, and whether it works. Secret values are never shown here — they stay in Vercel (or, for email and push, in Supabase Vault).`}
        actions={
          <>
            <a href={VERCEL_LINKS.backendEnv} target="_blank" rel="noreferrer" className="text-sm text-slate-600 underline hover:text-slate-900">
              Edit backend keys in Vercel ↗
            </a>
            <Button variant="primary" onClick={runChecks} disabled={isValidating}>
              {isValidating && checked ? "Checking…" : "Run live checks"}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card title="Backend readiness">
          {readinessLoading ? (
            <div role="status" aria-label="Loading">
              <Skeleton className="h-6 w-24" />
            </div>
          ) : (
            <Badge tone={readiness === "ready" ? "success" : "danger"}>{readiness === "ready" ? "Ready" : "Not ready"}</Badge>
          )}
          <p className="mt-2 text-xs text-slate-500">Public /health/ready check: can the API reach its database right now.</p>
        </Card>
        <Card title="Deployment" className="md:col-span-2">
          {report ? (
            <KeyValues
              items={[
                { label: "Environment", value: `${report.deployment.vercel_env ?? "not on Vercel"} · ${report.deployment.node_env}` },
                { label: "Region", value: report.deployment.region ?? "—" },
                {
                  label: "Commit",
                  value: report.deployment.commit_sha
                    ? `${report.deployment.commit_sha.slice(0, 7)} (${report.deployment.commit_ref ?? "?"}) ${report.deployment.commit_message ?? ""}`
                    : "—",
                },
                {
                  label: "Deployments",
                  value: (
                    <a href={VERCEL_LINKS.backendDeployments} target="_blank" rel="noreferrer" className="underline">
                      Open in Vercel ↗
                    </a>
                  ),
                },
              ]}
            />
          ) : (
            <Skeleton className="h-20 w-full" />
          )}
        </Card>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : error || !report ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load integrations.")} onRetry={() => mutate()} />
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-500">
            {report.live_checks ? `Live checks ran ${formatDateTime(report.checked_at)}.` : "Showing configuration only. Run live checks to test each service."}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {report.integrations.map((integration) => (
              <Card
                key={integration.id}
                title={integration.name}
                description={integration.purpose}
                actions={<Badge tone={STATUS[integration.status].tone}>{STATUS[integration.status].label}</Badge>}
              >
                <p className="mb-3 text-sm text-slate-600">
                  {integration.detail}
                  {integration.latency_ms !== null && <span className="text-slate-400"> · {integration.latency_ms} ms</span>}
                </p>
                <SettingsTable settings={integration.settings} />
                {integration.id === "r2_cors" && can("settings.manage") && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="primary" disabled={corsBusy} onClick={allowBrowserUploads}>
                      {corsBusy ? "Applying…" : "Allow browser uploads"}
                    </Button>
                    <span className="text-xs text-slate-500">Adds a CORS rule for these origins; existing rules are kept.</span>
                  </div>
                )}
              </Card>
            ))}
            <Card
              title="Admin Panel"
              description="This console's own build-time configuration"
              actions={
                <a href={VERCEL_LINKS.adminEnv} target="_blank" rel="noreferrer" className="text-xs text-slate-600 underline">
                  Edit in Vercel ↗
                </a>
              }
            >
              <p className="mb-3 text-sm text-slate-600">Baked into the browser bundle when the panel is built — changing one needs a new deployment.</p>
              <SettingsTable settings={adminPublicConfig().map((s) => ({ ...s, kind: s.key.endsWith("ANON_KEY") ? "identifier" : "public" }))} />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
