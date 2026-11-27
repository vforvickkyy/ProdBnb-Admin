"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { adminApi, unwrap } from "@/lib/api";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Template = components["schemas"]["SmsTemplate"];
type Preview = Template["preview"] & { dlt_text?: string };

const CATEGORY: Record<Template["category"], { label: string; dlt: string; help: string }> = {
  otp: { label: "Code", dlt: "OTP", help: "Sign-in and verification codes. Always sent." },
  transactional: { label: "Booking & payment", dlt: "Transactional", help: "Always sent: people need these to use the service." },
  service: { label: "Optional", dlt: "Service Implicit", help: "People can switch these off in their account settings." },
};
const AUDIENCE: Record<Template["audience"], string> = { booker: "Booker", host: "Host", everyone: "Everyone" };
const PLACEHOLDER_HELP: Record<string, string> = {
  code: "the sign-in code",
  name: "first name",
  place: "listing name",
  when: "date and time",
  ref: "booking reference",
  crew: "people on set",
  booker: "booker's name",
  amount: "amount in rupees",
  account: "last 4 digits of the bank account",
  brand: "brand name (fixed)",
  site: "website address (fixed)",
};

function copy(text: string, what: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied.`),
    () => toast.error("Couldn't copy."),
  );
}

function TemplateCard({ t, canManage, onSaved }: { t: Template; canManage: boolean; onSaved: (t: Template) => void }) {
  const [body, setBody] = useState(t.body);
  const [dltId, setDltId] = useState(t.dlt_template_id ?? "");
  const [providerId, setProviderId] = useState(t.provider_template_id ?? "");
  const [preview, setPreview] = useState<Preview>({ ...t.preview, dlt_text: t.dlt_text });
  const [busy, setBusy] = useState(false);
  const dirty = body !== t.body || dltId !== (t.dlt_template_id ?? "") || providerId !== (t.provider_template_id ?? "");

  useEffect(() => {
    if (body === t.body) {
      setPreview({ ...t.preview, dlt_text: t.dlt_text });
      return;
    }
    const timer = setTimeout(() => {
      adminApi
        .POST("/sms/preview", { body: { body } })
        .then(unwrap<Preview>)
        .then(setPreview)
        .catch(() => undefined);
    }, 350);
    return () => clearTimeout(timer);
  }, [body, t.body, t.preview, t.dlt_text]);

  async function save(patch: { body?: string; dlt_template_id?: string | null; provider_template_id?: string | null; enabled?: boolean }, done: string) {
    setBusy(true);
    try {
      const next = await adminApi.PATCH("/sms/templates/{key}", { params: { path: { key: t.key } }, body: patch }).then(unwrap<Template>);
      onSaved(next);
      toast.success(done);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Couldn't save."));
    } finally {
      setBusy(false);
    }
  }

  const cat = CATEGORY[t.category];
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {t.name}
          <Badge tone="neutral">{AUDIENCE[t.audience]}</Badge>
          <Badge tone={t.category === "service" ? "info" : "neutral"}>{cat.label}</Badge>
          {t.dlt_template_id ? <Badge tone="success">DLT ID added</Badge> : <Badge tone="warning">No DLT ID</Badge>}
        </span>
      }
      description={cat.help}
      actions={
        <Switch
          label={t.enabled ? "On" : "Off"}
          checked={t.enabled}
          disabled={!canManage || busy || t.key === "auth_otp"}
          onChange={(enabled) => void save({ enabled }, enabled ? "Text switched on." : "Text switched off.")}
        />
      }
    >
      <fieldset disabled={!canManage || busy} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <TextAreaField label="Wording" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              {t.variables.concat(["brand", "site"]).map((v, i) => (
                <span key={v}>
                  {i > 0 && " · "}
                  <code className="text-slate-700">{`{${v}}`}</code> {PLACEHOLDER_HELP[v] ?? ""}
                </span>
              ))}
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 text-[13px] font-medium text-slate-700">What people get (example)</div>
              <div className="rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-sm leading-5 text-slate-900">{preview.text}</div>
              <div className={preview.segments > 1 || preview.encoding !== "GSM-7" ? "mt-1 text-xs text-amber-700" : "mt-1 text-xs text-slate-500"}>
                {preview.characters} characters · {preview.segments} SMS {preview.segments > 1 ? "(costs more than one text)" : ""}
                {preview.encoding !== "GSM-7" && " · special characters make it a Unicode text (70 per SMS)"}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-slate-700">
                <span>For the DLT portal ({cat.dlt})</span>
                <Button size="sm" variant="ghost" onClick={() => copy(preview.dlt_text ?? t.dlt_text, "DLT text")}>
                  <Copy aria-hidden className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2 font-mono text-xs leading-5 text-slate-700 ring-1 ring-slate-200">{preview.dlt_text ?? t.dlt_text}</div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="DLT template ID" inputMode="numeric" value={dltId} placeholder="e.g. 1207160000000012345" hint="From the DLT portal once this wording is approved." onChange={(e) => setDltId(e.target.value.replace(/[^0-9]/g, ""))} />
          <TextField label="Provider's template ID (optional)" value={providerId} hint="Only if your provider gives each approved template its own ID." onChange={(e) => setProviderId(e.target.value)} />
        </div>
        {dirty && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={() =>
                void save(
                  { ...(body !== t.body ? { body } : {}), dlt_template_id: dltId || null, provider_template_id: providerId || null },
                  "Saved.",
                )
              }
            >
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setBody(t.body);
                setDltId(t.dlt_template_id ?? "");
                setProviderId(t.provider_template_id ?? "");
              }}
            >
              Undo
            </Button>
            {body !== t.body && t.dlt_template_id && <span className="text-xs text-amber-700">New wording needs a new DLT approval before it can go out.</span>}
          </div>
        )}
      </fieldset>
    </Card>
  );
}

export default function SmsTextsPage() {
  const { can } = useAdminMe();
  const canManage = can("channels.manage");
  const [who, setWho] = useState<"all" | Template["audience"]>("all");
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/sms/templates", () => adminApi.GET("/sms/templates").then(unwrap<Template[]>));

  if (isLoading && !data) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <ErrorState message={extractErrorMessage(error, "Couldn't load the texts.")} onRetry={() => void mutate()} />;

  const shown = data.filter((t) => who === "all" || t.audience === who);
  const missing = data.filter((t) => t.enabled && !t.dlt_template_id).length;

  function exportForDlt() {
    const csv = toCsv(data!, [
      { header: "Template name", value: (t) => t.name },
      { header: "DLT category", value: (t) => CATEGORY[t.category].dlt },
      { header: "Template text (DLT)", value: (t) => t.dlt_text },
      { header: "Variables", value: (t) => t.variables.join(", ") },
      { header: "Example", value: (t) => t.preview.text },
      { header: "DLT template ID", value: (t) => t.dlt_template_id ?? "" },
      { header: "Internal key", value: (t) => t.key },
    ]);
    downloadCsv(`sms-templates-for-dlt-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <>
      <PageHeader
        title="Texts & DLT templates"
        description={`Every text the system sends. Register each one on the DLT portal exactly as shown under "For the DLT portal", then paste its template ID here. ${missing ? `${missing} still need a DLT ID.` : "All have DLT IDs."}`}
        actions={
          <>
            <Link href="/messaging/sms" className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              SMS setup
            </Link>
            <Button variant="primary" onClick={exportForDlt}>
              <Download aria-hidden className="h-4 w-4" /> Download all for DLT
            </Button>
          </>
        }
      />
      <div className="mb-5">
        <Segmented<"all" | Template["audience"]>
          label="Who gets it"
          value={who}
          onChange={setWho}
          options={[
            { value: "all", label: "All" },
            { value: "booker", label: "Bookers" },
            { value: "host", label: "Hosts" },
            { value: "everyone", label: "Codes" },
          ]}
        />
      </div>
      <div className="space-y-5">
        {shown.map((t) => (
          <TemplateCard key={`${t.key}:${t.updated_at}`} t={t} canManage={canManage} onSaved={(next) => void mutate(data.map((x) => (x.key === next.key ? next : x)), { revalidate: false })} />
        ))}
      </div>
    </>
  );
}
