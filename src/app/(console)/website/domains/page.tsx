"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Check, Copy, ExternalLink, Globe, Plus, RefreshCw, Star } from "lucide-react";
import { Guide } from "@/components/messaging/ChannelCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Overview = components["schemas"]["SiteDomainsOverview"];
type SiteDomain = components["schemas"]["SiteDomain"];
type Integration = components["schemas"]["SiteIntegrationStatus"];

const STATUS: Record<SiteDomain["status"], { label: string; tone: "success" | "info" | "warning" }> = {
  active: { label: "Active", tone: "success" },
  redirect: { label: "Redirects", tone: "info" },
  pending_dns: { label: "Waiting for DNS", tone: "warning" },
  pending_verification: { label: "Needs verification", tone: "warning" },
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => undefined);
        setDone(true);
        window.setTimeout(() => setDone(false), 1500);
      }}
      className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      {done ? <Check aria-hidden className="h-3.5 w-3.5 text-green-600" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
    </button>
  );
}

function DnsRecords({ domain }: { domain: SiteDomain }) {
  if (domain.dns_records.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-[13px] text-slate-600">
        Add {domain.dns_records.length === 1 ? "this record" : "these records"} where you bought the domain (its DNS settings), then press
        <span className="font-medium text-slate-900"> Check again</span>. DNS changes can take a few minutes, occasionally a few hours.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[13px]">
          <caption className="sr-only">DNS records for {domain.name}</caption>
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th scope="col" className="py-1.5 pr-4 font-medium">Type</th>
              <th scope="col" className="py-1.5 pr-4 font-medium">Name / Host</th>
              <th scope="col" className="py-1.5 pr-4 font-medium">Value</th>
              <th scope="col" className="py-1.5 font-medium">For</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono text-slate-900">
            {domain.dns_records.map((r) => (
              <tr key={`${r.type}-${r.name}-${r.value}`}>
                <td className="py-2 pr-4">{r.type}</td>
                <td className="py-2 pr-4">
                  <span className="inline-flex items-center gap-1">
                    {r.name}
                    <CopyButton value={r.name} label={`${r.type} name`} />
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <span className="inline-flex items-center gap-1 break-all">
                    {r.value}
                    <CopyButton value={r.value} label={`${r.type} value`} />
                  </span>
                </td>
                <td className="py-2 font-sans text-xs text-slate-500">{r.purpose === "verify" ? "Proves you own it" : "Points it at the website"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DomainRow({
  domain,
  others,
  canManage,
  onChanged,
}: {
  domain: SiteDomain;
  others: SiteDomain[];
  canManage: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const status = STATUS[domain.status];
  const redirectTarget = others.find((d) => d.is_primary && d.name !== domain.name) ?? others.find((d) => !d.is_platform_domain && d.name !== domain.name && !d.redirect_to);

  async function run(key: string, action: () => Promise<unknown>, success?: string) {
    setBusy(key);
    try {
      await action();
      if (success) toast.success(success);
      await onChanged();
    } catch (e) {
      toast.error(extractErrorMessage(e, "That did not work."));
    } finally {
      setBusy(null);
    }
  }

  const path = { params: { path: { domain: domain.name } } };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://${domain.name}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 truncate text-[15px] font-medium text-slate-900 hover:underline"
            >
              {domain.name}
              <ExternalLink aria-hidden className="h-3.5 w-3.5 text-slate-400" />
            </a>
            {domain.is_primary && (
              <Badge tone="info">
                <Star aria-hidden className="h-3 w-3" /> Primary
              </Badge>
            )}
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            {domain.is_platform_domain && <Badge>Vercel address</Badge>}
          </div>
          <p className="mt-1 text-[13px] text-slate-500">
            {domain.redirect_to
              ? `Sends visitors to ${domain.redirect_to}.`
              : domain.is_primary
                ? "The website's main address: used in Google results, share links and sitemaps."
                : domain.is_platform_domain
                  ? "Always works; fine for testing, not meant for customers."
                  : domain.status === "active"
                    ? "Serves the website."
                    : "Not live yet — finish the steps below."}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {domain.status !== "active" && domain.status !== "redirect" && (
              <Button size="sm" disabled={busy !== null} onClick={() => run("verify", () => adminApi.POST("/site/domains/{domain}/verify", path).then(unwrap))}>
                <RefreshCw aria-hidden className={cn("h-3.5 w-3.5", busy === "verify" && "animate-spin")} /> Check again
              </Button>
            )}
            {!domain.is_primary && !domain.is_platform_domain && domain.status === "active" && (
              <Button
                size="sm"
                variant="primary"
                disabled={busy !== null}
                onClick={() =>
                  run("primary", () => adminApi.PUT("/site/primary-domain", { body: { domain: domain.name } }).then(unwrap), `${domain.name} is now the primary domain.`)
                }
              >
                Make primary
              </Button>
            )}
            {!domain.is_primary && !domain.is_platform_domain && !domain.redirect_to && redirectTarget && (
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  run(
                    "redirect",
                    () => adminApi.PATCH("/site/domains/{domain}", { ...path, body: { redirect_to: redirectTarget.name } }).then(unwrap),
                    `${domain.name} now redirects to ${redirectTarget.name}.`
                  )
                }
              >
                Redirect to {redirectTarget.name}
              </Button>
            )}
            {domain.redirect_to && (
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() => run("unredirect", () => adminApi.PATCH("/site/domains/{domain}", { ...path, body: { redirect_to: null } }).then(unwrap), "Redirect removed.")}
              >
                Stop redirecting
              </Button>
            )}
            {!domain.is_primary && !domain.is_platform_domain && (
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirmRemove(true)}>
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
      <DnsRecords domain={domain} />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${domain.name}?`}
        description="The website stops answering on this address. DNS records you created stay with your domain provider."
        danger
        busy={busy === "remove"}
        confirmLabel="Remove domain"
        onConfirm={() => run("remove", () => adminApi.DELETE("/site/domains/{domain}", path).then(unwrap), `${domain.name} removed.`).then(() => setConfirmRemove(false))}
      />
    </li>
  );
}

function AddDomainDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: () => Promise<unknown> }) {
  const [name, setName] = useState("");
  const [withWww, setWithWww] = useState(true);
  const [busy, setBusy] = useState(false);
  const clean = name.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const isApex = clean.split(".").length === 2;

  async function add() {
    setBusy(true);
    try {
      await adminApi.POST("/site/domains", { body: { name: clean } }).then(unwrap);
      if (isApex && withWww) {
        await adminApi.POST("/site/domains", { body: { name: `www.${clean}`, redirect_to: clean } }).then(unwrap);
      }
      toast.success(isApex && withWww ? `${clean} and www.${clean} added.` : `${clean} added.`);
      setName("");
      onOpenChange(false);
      await onAdded();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not add the domain."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add a domain" description="A domain you own, e.g. example.com. Buy one from any registrar first (GoDaddy, Namecheap, Google, Cloudflare…).">
      <TextField label="Domain" value={name} onChange={(e) => setName(e.target.value)} placeholder="example.com" autoFocus />
      {isApex && (
        <label className="mt-3 flex items-start gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={withWww} onChange={(e) => setWithWww(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent-500))]" />
          <span>
            Also add <span className="font-medium">www.{clean}</span> and send it to {clean}
            <span className="block text-xs text-slate-500">Recommended: people type both.</span>
          </span>
        </label>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="primary" disabled={busy || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(clean)} onClick={add}>
          {busy ? "Adding…" : "Add domain"}
        </Button>
      </div>
    </Dialog>
  );
}

function ConnectVercel({ integration, canManage, onSaved }: { integration?: Integration; canManage: boolean; onSaved: () => Promise<unknown> }) {
  const [projectId, setProjectId] = useState((integration?.config.project_id as string | undefined) ?? "");
  const [teamId, setTeamId] = useState((integration?.config.team_id as string | undefined) ?? "");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const connected = Boolean(integration?.connected);

  async function save() {
    setBusy(true);
    try {
      await adminApi
        .PUT("/site/integrations/vercel", { body: { project_id: projectId.trim(), team_id: teamId.trim() || null, ...(token.trim() ? { token: token.trim() } : {}) } })
        .then(unwrap);
      toast.success("Vercel connected.");
      setToken("");
      await onSaved();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not connect Vercel."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={connected ? "Vercel project" : "Connect the website's Vercel project"}
      description={
        connected
          ? `Domains are managed on “${(integration?.config.project_name as string) ?? projectId}”. The token is stored encrypted and never shown again.`
          : "Domains are attached to the website through Vercel, where it is hosted. Connect once; the token is stored encrypted (Supabase Vault) and never shown again."
      }
    >
      {canManage ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Project ID" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="prj_…" />
          <TextField label="Team ID (if the project is in a team)" value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="team_…" />
          <TextField
            className="sm:col-span-2"
            label={connected ? "Access token (leave empty to keep the current one)" : "Access token"}
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <div className="flex justify-end sm:col-span-2">
            <Button variant="primary" disabled={busy || !projectId.trim() || (!connected && !token.trim())} onClick={save}>
              {busy ? "Checking…" : connected ? "Save" : "Connect"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Only a super admin can connect Vercel.</p>
      )}
    </Card>
  );
}

export default function DomainsPage() {
  const { can } = useAdminMe();
  const canManage = can("site.manage");
  const [adding, setAdding] = useState(false);
  const domains = useSWR("/v1/admin/site/domains", () => adminApi.GET("/site/domains").then(unwrap<Overview>));
  const integrations = useSWR("/v1/admin/site/integrations", () => adminApi.GET("/site/integrations").then(unwrap<Integration[]>));
  const vercel = integrations.data?.find((i) => i.provider === "vercel");
  const refresh = () => Promise.all([domains.mutate(), integrations.mutate()]);
  const data = domains.data;

  return (
    <>
      <PageHeader
        title="Domains"
        description="The addresses the public website answers on. The primary domain is the one Google, share links and sitemaps use, and the only extra one the API accepts browser calls from."
        actions={
          canManage &&
          data?.vercel_connected && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus aria-hidden className="h-4 w-4" /> Add domain
            </Button>
          )
        }
      />

      {domains.isLoading || integrations.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : domains.error || !data ? (
        <ErrorState message={extractErrorMessage(domains.error, "Failed to load domains.")} onRetry={() => domains.mutate()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {data.vercel_connected ? (
              data.domains.length === 0 ? (
                <EmptyState title="No domains yet" description="Add the domain you bought for the website." />
              ) : (
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Globe aria-hidden className="h-4 w-4 text-slate-400" /> Website domains
                    </h2>
                    <button type="button" onClick={() => domains.mutate()} className="text-xs text-slate-500 hover:text-slate-900">
                      Refresh
                    </button>
                  </div>
                  <ul className="divide-y divide-slate-200">
                    {data.domains.map((d) => (
                      <DomainRow key={d.name} domain={d} others={data.domains} canManage={canManage} onChanged={refresh} />
                    ))}
                  </ul>
                </section>
              )
            ) : null}
            <ConnectVercel key={vercel?.updated_at ?? "new"} integration={vercel} canManage={canManage} onSaved={refresh} />
          </div>

          <div className="space-y-6">
            <Guide
              title="Connecting a domain"
              steps={[
                <>Buy the domain from any registrar once the name is final.</>,
                <>
                  Press <strong>Add domain</strong> here. Keep “also add www” on.
                </>,
                <>Copy the DNS records shown under each domain into your registrar&apos;s DNS settings.</>,
                <>
                  Press <strong>Check again</strong> until it says Active (minutes, sometimes hours). HTTPS is set up automatically.
                </>,
                <>
                  Press <strong>Make primary</strong> on the main domain. The website, sitemaps and Google results switch to it.
                </>,
              ]}
            />
            <Guide
              title="Getting the Vercel details (once)"
              steps={[
                <>In Vercel, open the website&apos;s project → Settings → General and copy the Project ID.</>,
                <>If the project is in a team, copy the Team ID from the team&apos;s Settings → General.</>,
                <>Account Settings → Tokens → Create, scoped to that team. Paste it here; it is stored encrypted.</>,
              ]}
            />
          </div>
        </div>
      )}
      <AddDomainDialog open={adding} onOpenChange={setAdding} onAdded={refresh} />
    </>
  );
}
