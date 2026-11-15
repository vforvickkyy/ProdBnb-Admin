"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import useSWR from "swr";
import { AlertTriangle, Apple, Globe, Plus, Server, Smartphone, Wrench } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Overview = components["schemas"]["PlatformsOverview"];
type AppPlatform = components["schemas"]["AppPlatform"];
type Flag = components["schemas"]["FeatureFlag"];
type Incident = components["schemas"]["PlatformIncident"];
type Release = components["schemas"]["ReleasePlan"];
type ClientPlatform = "ios" | "android" | "web";
type Tab = "flags" | "incidents" | "releases" | "versions";

const PLATFORM_META: Record<ClientPlatform, { icon: typeof Apple; provider: string }> = {
  ios: { icon: Apple, provider: "apns" },
  android: { icon: Smartphone, provider: "fcm" },
  web: { icon: Globe, provider: "webpush" },
};

const STATUS_TONE: Record<string, BadgeTone> = {
  live: "success",
  beta: "info",
  in_development: "warning",
  not_launched: "neutral",
  maintenance: "danger",
  deprecated: "neutral",
};

const SEVERITY_TONE: Record<string, BadgeTone> = { minor: "info", major: "warning", critical: "danger" };

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((p) => parseInt(p, 10) || 0);
  const pb = b.split(".").map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export default function PlatformsPage() {
  return (
    <Suspense fallback={<AdminShell><Skeleton className="h-96 w-full" /></AdminShell>}>
      <Platforms />
    </Suspense>
  );
}

function Platforms() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (["flags", "incidents", "releases", "versions"].includes(searchParams.get("tab") ?? "") ? searchParams.get("tab") : "incidents") as Tab;
  const { can } = useAdminMe();
  const manage = can("platforms.manage");
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/platforms", () => adminApi.GET("/platforms").then(unwrap<Overview>));
  const [editing, setEditing] = useState<AppPlatform | null>(null);

  if (isLoading) {
    return (
      <AdminShell>
        <PageHeader title="Platforms & Releases" />
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </AdminShell>
    );
  }
  if (error || !data) {
    return (
      <AdminShell>
        <PageHeader title="Platforms & Releases" />
        <ErrorState message={extractErrorMessage(error, "Failed to load platforms.")} onRetry={() => mutate()} />
      </AdminShell>
    );
  }

  const openIncidents = data.incidents.filter((i) => i.status !== "resolved");
  const order: ClientPlatform[] = ["ios", "android", "web"];
  const platforms = order.map((p) => data.platforms.find((x) => x.platform === p)).filter(Boolean) as AppPlatform[];

  return (
    <AdminShell>
      <PageHeader
        title="Platforms & Releases"
        description="What is live on iOS, Android and the web, which features each has, open issues, and what ships next. The apps read this through GET /v1/app-config."
      />

      {openIncidents.length > 0 && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {openIncidents.length} open incident{openIncidents.length === 1 ? "" : "s"}: {openIncidents.map((i) => i.title).join(" · ")}
          </span>
        </div>
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {platforms.map((p) => {
          const meta = PLATFORM_META[p.platform];
          const Icon = meta.icon;
          const push = data.health.push_last_24h[meta.provider];
          const incidents = openIncidents.filter((i) => i.platforms.includes(p.platform)).length;
          return (
            <Card
              key={p.id}
              title={
                <span className="flex items-center gap-2">
                  <Icon aria-hidden className="h-4 w-4 text-slate-500" /> {p.display_name}
                </span>
              }
              actions={
                manage ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                ) : undefined
              }
            >
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{humanize(p.status)}</Badge>
                {p.maintenance_mode && (
                  <Badge tone="danger">
                    <Wrench aria-hidden className="mr-1 h-3 w-3" /> Maintenance
                  </Badge>
                )}
                {incidents > 0 && <Badge tone="warning">{incidents} incident{incidents === 1 ? "" : "s"}</Badge>}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Live", p.live_version],
                  ["Latest", p.latest_version],
                  ["Minimum", p.min_supported_version],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-slate-50 px-2 py-1.5">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="font-mono text-sm text-slate-900">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-slate-500">
                {data.health.active_devices[p.platform]} active device{data.health.active_devices[p.platform] === 1 ? "" : "s"}
                {push ? ` · push 24h: ${push.sent} sent, ${push.failed + push.invalid_token} failed` : " · no pushes in 24h"}
              </p>
            </Card>
          );
        })}
        <Card
          title={
            <span className="flex items-center gap-2">
              <Server aria-hidden className="h-4 w-4 text-slate-500" /> Backend API
            </span>
          }
        >
          <div className="mb-3">
            <Badge tone="success">running</Badge>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Environment</dt>
              <dd className="text-slate-800">{data.health.backend.environment}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Commit</dt>
              <dd className="font-mono text-slate-800">{data.health.backend.commit ?? "local"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Region</dt>
              <dd className="text-slate-800">{data.health.backend.region ?? "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Tabs<Tab>
        label="Release control"
        value={tab}
        onChange={(t) => router.replace(`/platforms?tab=${t}`, { scroll: false })}
        items={[
          { value: "incidents", label: "Incidents", badge: openIncidents.length ? <Count n={openIncidents.length} warn /> : undefined },
          { value: "flags", label: "Feature flags", badge: <Count n={data.feature_flags.length} /> },
          { value: "releases", label: "Releases", badge: <Count n={data.releases.filter((r) => r.status !== "released" && r.status !== "cancelled").length} /> },
          { value: "versions", label: "Versions in use" },
        ]}
      />
      {tab === "incidents" && (
        <TabPanel value="incidents">
          <IncidentsTab incidents={data.incidents} canManage={can("incidents.manage")} onChanged={() => mutate()} />
        </TabPanel>
      )}
      {tab === "flags" && (
        <TabPanel value="flags">
          <FlagsTab flags={data.feature_flags} manage={manage} onChanged={() => mutate()} />
        </TabPanel>
      )}
      {tab === "releases" && (
        <TabPanel value="releases">
          <ReleasesTab releases={data.releases} flags={data.feature_flags} manage={manage} onChanged={() => mutate()} />
        </TabPanel>
      )}
      {tab === "versions" && (
        <TabPanel value="versions">
          <VersionsTab versions={data.versions_in_use} platforms={platforms} />
        </TabPanel>
      )}

      {editing && <PlatformSheet platform={editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />}
    </AdminShell>
  );
}

function Count({ n, warn }: { n: number; warn?: boolean }) {
  return <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", warn ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")}>{n}</span>;
}

// ---------------------------------------------------------------------------------------------------
// Platform editor
// ---------------------------------------------------------------------------------------------------

function PlatformSheet({ platform, onClose, onSaved }: { platform: AppPlatform; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    status: platform.status,
    live_version: platform.live_version ?? "",
    latest_version: platform.latest_version ?? "",
    min_supported_version: platform.min_supported_version ?? "",
    store_url: platform.store_url ?? "",
    update_message: platform.update_message ?? "",
    force_update_message: platform.force_update_message ?? "",
    maintenance_mode: platform.maintenance_mode,
    maintenance_message: platform.maintenance_message ?? "",
    notes: platform.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm({ ...form, [k]: v });
  const n = (v: string) => (v.trim() ? v.trim() : null);

  async function save() {
    setBusy(true);
    try {
      await adminApi
        .PATCH("/platforms/{platform}", {
          params: { path: { platform: platform.platform } },
          body: {
            status: form.status,
            live_version: n(form.live_version),
            latest_version: n(form.latest_version),
            min_supported_version: n(form.min_supported_version),
            store_url: n(form.store_url),
            update_message: n(form.update_message),
            force_update_message: n(form.force_update_message),
            maintenance_mode: form.maintenance_mode,
            maintenance_message: n(form.maintenance_message),
            notes: n(form.notes),
          },
        })
        .then(unwrap);
      toast.success(`${platform.display_name} updated. Apps pick it up within a minute.`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not save."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={`Edit ${platform.display_name}`} description="Every change is audited and served to the apps via /v1/app-config.">
      <div className="space-y-5">
        <SelectField label="Launch status" value={form.status} onChange={(e) => set("status", e.target.value as never)}>
          {["not_launched", "in_development", "beta", "live", "maintenance", "deprecated"].map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Live version" value={form.live_version} onChange={(e) => set("live_version", e.target.value)} placeholder="1.4.0" />
          <TextField label="Latest version" value={form.latest_version} onChange={(e) => set("latest_version", e.target.value)} placeholder="1.5.0" />
          <TextField label="Minimum" value={form.min_supported_version} onChange={(e) => set("min_supported_version", e.target.value)} placeholder="1.2.0" />
        </div>
        <p className="-mt-2 text-xs text-slate-500">
          Below <b>Minimum</b>: the app must update before it can be used. Below <b>Latest</b>: it shows an optional “update available” prompt.
        </p>
        <TextField label="Store / download link" value={form.store_url} onChange={(e) => set("store_url", e.target.value)} placeholder="https://apps.apple.com/app/…" />
        <TextAreaField label="Optional update message" rows={2} maxLength={300} value={form.update_message} onChange={(e) => set("update_message", e.target.value)} />
        <TextAreaField label="Forced update message" rows={2} maxLength={300} value={form.force_update_message} onChange={(e) => set("force_update_message", e.target.value)} />
        <div className="rounded-lg border border-slate-200 p-3">
          <Switch
            checked={form.maintenance_mode}
            onChange={(v) => set("maintenance_mode", v)}
            label="Maintenance mode"
            description="The app shows the message below instead of letting people book."
          />
          {form.maintenance_mode && (
            <TextAreaField
              className="mt-3"
              label="Maintenance message"
              rows={2}
              maxLength={300}
              value={form.maintenance_message}
              onChange={(e) => set("maintenance_message", e.target.value)}
            />
          )}
        </div>
        <TextAreaField label="Internal notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} hint="Only admins see these." />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------------------------------

const ALL_PLATFORMS = ["ios", "android", "web", "backend", "admin"] as const;

function IncidentsTab({ incidents, canManage, onChanged }: { incidents: Incident[]; canManage: boolean; onChanged: () => void }) {
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState<Incident | null>(null);
  const sorted = useMemo(
    () => [...incidents].sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved") || b.started_at.localeCompare(a.started_at)),
    [incidents]
  );
  return (
    <div>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="h-4 w-4" /> Report incident
          </Button>
        </div>
      )}
      {sorted.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">No incidents. All quiet.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((i) => (
            <li key={i.id} className={cn("rounded-lg border bg-white p-4", i.status === "resolved" ? "border-slate-200 opacity-80" : "border-amber-200")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{i.title}</span>
                    <Badge tone={SEVERITY_TONE[i.severity] ?? "neutral"}>{i.severity}</Badge>
                    <Badge tone={i.status === "resolved" ? "success" : "warning"}>{i.status}</Badge>
                    {i.is_public && <Badge tone="info">shown in apps</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {i.platforms.join(", ")} · started {formatDateTime(i.started_at)}
                    {i.resolved_at ? ` · resolved ${formatDateTime(i.resolved_at)}` : ""}
                  </p>
                  {i.summary && <p className="mt-2 text-sm text-slate-700">{i.summary}</p>}
                </div>
                {canManage && (
                  <Button size="sm" onClick={() => setUpdating(i)}>
                    Post update
                  </Button>
                )}
              </div>
              {i.updates.length > 0 && (
                <ol className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4">
                  {i.updates.map((u) => (
                    <li key={u.id} className="text-sm">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {u.status} · {formatDateTime(u.created_at)}
                      </span>
                      <p className="text-slate-700">{u.message}</p>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
      {creating && <IncidentDialog onClose={() => setCreating(false)} onSaved={onChanged} />}
      {updating && <IncidentDialog incident={updating} onClose={() => setUpdating(null)} onSaved={onChanged} />}
    </div>
  );
}

function IncidentDialog({ incident, onClose, onSaved }: { incident?: Incident; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(incident?.title ?? "");
  const [summary, setSummary] = useState(incident?.summary ?? "");
  const [severity, setSeverity] = useState(incident?.severity ?? "minor");
  const [status, setStatus] = useState<Incident["status"]>(incident?.status ?? "investigating");
  const [platforms, setPlatforms] = useState<string[]>(incident?.platforms ?? ["ios"]);
  const [isPublic, setIsPublic] = useState(incident?.is_public ?? false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (incident) {
        await adminApi
          .PATCH("/incidents/{incidentId}", {
            params: { path: { incidentId: incident.id } },
            body: { summary, severity, status, is_public: isPublic, platforms: platforms as never, ...(message.trim() ? { message: message.trim() } : {}) },
          })
          .then(unwrap);
      } else {
        await adminApi
          .POST("/incidents", {
            body: { title: title.trim(), summary, severity, status, platforms: platforms as never, is_public: isPublic, ...(message.trim() ? { message: message.trim() } : {}) },
          })
          .then(unwrap);
      }
      toast.success(incident ? "Incident updated." : "Incident reported.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not save."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={incident ? `Update: ${incident.title}` : "Report an incident"}>
      <div className="space-y-3">
        {!incident && <TextField label="Title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Payments delayed" />}
        <TextAreaField label="Public summary" rows={2} maxLength={1000} value={summary} onChange={(e) => setSummary(e.target.value)} hint="Shown in the apps when “Show in apps” is on." />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value as never)}>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </SelectField>
          <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as never)}>
            {["investigating", "identified", "monitoring", "resolved"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">Affects</legend>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((p) => {
              const on = platforms.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p) : [...platforms, p])}
                  className={cn("rounded-full border px-3 py-1 text-sm", on ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-700")}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Switch checked={isPublic} onChange={setIsPublic} label="Show in apps" description="Open public incidents are sent to the affected apps in /v1/app-config." />
        <TextAreaField label={incident ? "Timeline update" : "First timeline entry (optional)"} rows={2} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy || (!incident && !title.trim()) || platforms.length === 0} onClick={save}>
            {busy ? "Saving…" : incident ? "Post update" : "Report"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------------------------------

function FlagsTab({ flags, manage, onChanged }: { flags: Flag[]; manage: boolean; onChanged: () => void }) {
  const [creating, setCreating] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function setTarget(flag: Flag, platform: ClientPlatform, patch: { enabled?: boolean; min_version?: string | null }) {
    const current = flag.targets[platform] ?? { enabled: false, min_version: null };
    const targets = { ...flag.targets, [platform]: { ...current, ...patch } };
    try {
      await adminApi.PATCH("/feature-flags/{flagId}", { params: { path: { flagId: flag.id } }, body: { targets } }).then(unwrap);
      onChanged();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not update the flag."));
    }
  }

  async function create() {
    setBusy(true);
    try {
      await adminApi.POST("/feature-flags", { body: { key: key.trim(), name: name.trim(), description: description.trim(), targets: {} } }).then(unwrap);
      toast.success("Feature flag created. Switch it on per platform.");
      setCreating(false);
      setKey("");
      setName("");
      setDescription("");
      onChanged();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not create the flag."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Turn features on per platform — optionally only from a minimum app version. Apps read them at launch.</p>
        {manage && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="h-4 w-4" /> New flag
          </Button>
        )}
      </div>
      {flags.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">No feature flags yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">Feature flags</caption>
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Feature</th>
                {(["ios", "android", "web"] as const).map((p) => (
                  <th key={p} className="px-4 py-2 font-medium">
                    {p === "ios" ? "iOS" : p === "android" ? "Android" : "Web"}
                  </th>
                ))}
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flags.map((flag) => (
                <tr key={flag.id}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-slate-900">{flag.name}</div>
                    <code className="text-xs text-slate-500">{flag.key}</code>
                    {flag.description && <p className="mt-1 max-w-sm text-xs text-slate-500">{flag.description}</p>}
                  </td>
                  {(["ios", "android", "web"] as const).map((p) => {
                    const t = flag.targets[p];
                    return (
                      <td key={p} className="px-4 py-3 align-top">
                        <Switch checked={Boolean(t?.enabled)} disabled={!manage} onChange={(v) => setTarget(flag, p, { enabled: v })} label={t?.enabled ? "On" : "Off"} />
                        {t?.enabled && (
                          <input
                            aria-label={`${flag.name} minimum ${p} version`}
                            defaultValue={t.min_version ?? ""}
                            disabled={!manage}
                            placeholder="any version"
                            onBlur={(e) => {
                              const v = e.target.value.trim() || null;
                              if (v !== (t.min_version ?? null)) void setTarget(flag, p, { min_version: v });
                            }}
                            className="mt-2 w-28 rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs text-slate-800"
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right align-top">
                    {manage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await adminApi.DELETE("/feature-flags/{flagId}", { params: { path: { flagId: flag.id } } }).then(unwrap);
                            toast.success("Flag deleted.");
                            onChanged();
                          } catch (e) {
                            toast.error(extractErrorMessage(e, "Could not delete."));
                          }
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={creating} onOpenChange={setCreating} title="New feature flag">
        <div className="space-y-3">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Collections on home screen" />
          <TextField
            label="Key"
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, "_"))}
            hint="What the apps check, e.g. collections_home. Cannot be changed later."
          />
          <TextAreaField label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" disabled={busy || !name.trim() || !/^[a-z][a-z0-9_.-]{1,63}$/.test(key)} onClick={create}>
              Create
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// Releases
// ---------------------------------------------------------------------------------------------------

function ReleasesTab({ releases, flags, manage, onChanged }: { releases: Release[]; flags: Flag[]; manage: boolean; onChanged: () => void }) {
  const [creating, setCreating] = useState(false);
  const [platform, setPlatform] = useState<Release["platform"]>("ios");
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);
  const columns: Release["status"][] = ["planned", "in_progress", "in_review", "released"];

  async function update(release: Release, body: Record<string, unknown>, success: string) {
    try {
      await adminApi.PATCH("/releases/{releaseId}", { params: { path: { releaseId: release.id } }, body: body as never }).then(unwrap);
      toast.success(success);
      onChanged();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not update the release."));
    }
  }

  async function create() {
    setBusy(true);
    try {
      await adminApi
        .POST("/releases", { body: { platform, version: version.trim(), title: title.trim(), notes, target_date: targetDate || null, status: "planned", feature_keys: [], promote_to_live: false } })
        .then(unwrap);
      toast.success("Release planned.");
      setCreating(false);
      setVersion("");
      setTitle("");
      setNotes("");
      setTargetDate("");
      onChanged();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not plan the release."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Track what ships next on each platform. Marking an app release as released can also promote it to the live version.</p>
        {manage && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="h-4 w-4" /> Plan release
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => {
          const items = releases.filter((r) => r.status === col).slice(0, col === "released" ? 8 : 50);
          return (
            <section key={col} aria-label={humanize(col)} className="rounded-lg bg-slate-100 p-3">
              <h3 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600">
                {humanize(col)} <span className="text-slate-400">{items.length}</span>
              </h3>
              <ul className="space-y-2">
                {items.length === 0 && <li className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">Nothing here</li>}
                {items.map((r) => (
                  <li key={r.id} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="neutral">{r.platform}</Badge>
                      <code className="text-xs text-slate-600">{r.version}</code>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900">{r.title}</p>
                    {r.notes && <p className="mt-1 line-clamp-3 text-xs text-slate-500">{r.notes}</p>}
                    <p className="mt-2 text-xs text-slate-500">
                      {r.status === "released" ? `Released ${formatDate(r.released_at)}` : r.target_date ? `Target ${formatDate(r.target_date)}` : "No target date"}
                    </p>
                    {manage && r.status !== "released" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <select
                          aria-label={`Status of ${r.title}`}
                          value={r.status}
                          onChange={(e) => update(r, { status: e.target.value }, "Release moved.")}
                          className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-700"
                        >
                          {["planned", "in_progress", "in_review", "cancelled"].map((s) => (
                            <option key={s} value={s}>
                              {humanize(s)}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="brand"
                          onClick={() =>
                            update(
                              r,
                              { status: "released", promote_to_live: ["ios", "android", "web"].includes(r.platform) },
                              ["ios", "android", "web"].includes(r.platform) ? `Released — ${r.platform} live version is now ${r.version}.` : "Marked released."
                            )
                          }
                        >
                          Mark released
                        </Button>
                      </div>
                    )}
                    {r.feature_keys.length > 0 && (
                      <p className="mt-2 text-[11px] text-slate-500">Flags: {r.feature_keys.map((k) => flags.find((f) => f.key === k)?.name ?? k).join(", ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <Dialog open={creating} onOpenChange={setCreating} title="Plan a release">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as never)}>
              {ALL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </SelectField>
            <TextField label="Version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.6.0" />
          </div>
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Collections & saved searches" />
          <TextAreaField label="Release notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <TextField label="Target date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" disabled={busy || !version.trim() || !title.trim()} onClick={create}>
              Plan release
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// Versions in use
// ---------------------------------------------------------------------------------------------------

function VersionsTab({ versions, platforms }: { versions: Overview["versions_in_use"]; platforms: AppPlatform[] }) {
  if (versions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        No version data yet. Apps report their version by sending <code>X-ProdBnb-Platform</code> and <code>X-ProdBnb-App-Version</code> headers (and{" "}
        <code>app_version</code> when registering for push) — wired up in the next app releases.
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(["ios", "android", "web"] as const).map((p) => {
        const rows = versions.filter((v) => v.platform === p).sort((a, b) => compareVersions(b.app_version, a.app_version));
        const meta = platforms.find((x) => x.platform === p);
        const total = rows.reduce((sum, r) => sum + r.users, 0);
        return (
          <Card key={p} title={meta?.display_name ?? p} description="Signed-in users in the last 30 days, and active push devices.">
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">No data.</p>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">{meta?.display_name} versions</caption>
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1 font-medium">Version</th>
                    <th className="py-1 text-right font-medium">Users</th>
                    <th className="py-1 text-right font-medium">Devices</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const forced = meta?.min_supported_version ? compareVersions(r.app_version, meta.min_supported_version) < 0 : false;
                    return (
                      <tr key={r.app_version}>
                        <td className="py-1.5 font-mono">
                          {r.app_version} {forced && <Badge tone="danger">must update</Badge>}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {r.users}
                          {total > 0 && <span className="ml-1 text-xs text-slate-400">{Math.round((r.users / total) * 100)}%</span>}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{r.devices}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        );
      })}
    </div>
  );
}
