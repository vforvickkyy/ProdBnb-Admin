"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { CheckCircle2, Copy, Lock, Send, TriangleAlert } from "lucide-react";
import { Guide } from "@/components/messaging/ChannelCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Overview = components["schemas"]["SmsOverview"];
type Provider = Overview["providers"][number];
type Mode = Overview["settings"]["mode"];
type Template = components["schemas"]["SmsTemplate"];
type SettingsPatch = {
  mode?: Mode;
  active_provider?: Provider["id"] | null;
  sender_id?: string | null;
  dlt_entity_id?: string | null;
  test_numbers?: string[];
  otp_per_hour?: number;
};

const MODES: { value: Mode; label: string; help: string }[] = [
  { value: "off", label: "Off", help: "No texts at all, and sign-in by SMS code is refused." },
  {
    value: "test",
    label: "Test",
    help: "Every text is written to the log with its exact wording, but nothing is sent, except to the test numbers below (when a provider is connected). Sign-in codes show in the log so the team can sign in. Use this until DLT is approved.",
  },
  { value: "live", label: "Live", help: "Texts go to everyone through the chosen provider. Switch on once DLT is approved and the DLT template IDs are filled in." },
];

function copy(text: string, what: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied.`),
    () => toast.error("Couldn't copy."),
  );
}

function ProviderForm({ provider, canManage, onSaved }: { provider: Provider; canManage: boolean; onSaved: (o: Overview) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setValues(Object.fromEntries(provider.fields.filter((f) => !f.secret).map((f) => [f.key, provider.config[f.key] ?? ""])));
  }, [provider.id, provider.config, provider.fields]);

  async function save() {
    setBusy(true);
    try {
      const next = await adminApi
        .PUT("/sms/providers/{provider}", { params: { path: { provider: provider.id } }, body: values })
        .then(unwrap<Overview>);
      toast.success(`${provider.name} saved.`);
      setValues((v) => Object.fromEntries(Object.entries(v).filter(([k]) => !provider.fields.find((f) => f.key === k)?.secret)));
      onSaved(next);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Couldn't save."));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm(`Disconnect ${provider.name} and delete its key?`)) return;
    setBusy(true);
    try {
      const next = await adminApi.DELETE("/sms/providers/{provider}", { params: { path: { provider: provider.id } } }).then(unwrap<Overview>);
      toast.success(`${provider.name} disconnected.`);
      onSaved(next);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Couldn't disconnect."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset disabled={!canManage || busy} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {provider.fields.map((f) => (
          <TextField
            key={f.key}
            label={`${f.label}${f.required ? "" : " (optional)"}`}
            type={f.secret ? "password" : "text"}
            autoComplete="off"
            value={values[f.key] ?? ""}
            placeholder={f.secret && f.saved ? "Saved. Leave empty to keep it" : f.placeholder}
            hint={f.help}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        ))}
      </div>
      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Keys are stored encrypted (Supabase Vault) and never shown again. To change one, paste the new one.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void save()}>{provider.connected ? "Save changes" : `Connect ${provider.name}`}</Button>
        {provider.connected && (
          <Button variant="secondary" onClick={() => void disconnect()}>
            Disconnect
          </Button>
        )}
      </div>
    </fieldset>
  );
}

export default function SmsSetupPage() {
  const { can } = useAdminMe();
  const canManage = can("channels.manage");
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/sms/settings", () => adminApi.GET("/sms/settings").then(unwrap<Overview>));
  const { data: templates } = useSWR("/v1/admin/sms/templates", () => adminApi.GET("/sms/templates").then(unwrap<Template[]>));
  const [tab, setTab] = useState<Provider["id"]>("msg91");
  const [sender, setSender] = useState("");
  const [entity, setEntity] = useState("");
  const [perHour, setPerHour] = useState("5");
  const [numbers, setNumbers] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testTemplate, setTestTemplate] = useState("auth_otp");
  const [hookSecret, setHookSecret] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSender(data.settings.sender_id ?? "");
    setEntity(data.settings.dlt_entity_id ?? "");
    setPerHour(String(data.settings.otp_per_hour));
    setNumbers(data.settings.test_numbers.join("\n"));
    if (data.settings.active_provider) setTab(data.settings.active_provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.settings.updated_at]);

  async function patch(body: SettingsPatch, done: string) {
    setBusy(true);
    try {
      const next = await adminApi.PATCH("/sms/settings", { body }).then(unwrap<Overview>);
      void mutate(next, { revalidate: false });
      toast.success(done);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Couldn't save."));
    } finally {
      setBusy(false);
    }
  }

  async function saveHookSecret(secret: string | null) {
    setBusy(true);
    try {
      const next = await adminApi.PUT("/sms/hook-secret", { body: { secret } }).then(unwrap<Overview>);
      void mutate(next, { revalidate: false });
      setHookSecret("");
      toast.success(secret ? "Sign-in codes connected." : "Hook secret removed.");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Couldn't save."));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const row = await adminApi.POST("/sms/test", { body: { phone: testTo, template: testTemplate } }).then(unwrap<components["schemas"]["AdminSms"]>);
      if (row.status === "failed") toast.error(row.last_error ?? "It didn't go.");
      else if (row.provider === "test") toast.success("Logged only (test mode, not a test number). See it under Automatic texts.");
      else toast.success(`Sent through ${row.provider}. Check the phone.`);
      void mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Couldn't send."));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading && !data) return <Skeleton className="h-96 w-full" />;
  if (error || !data) return <ErrorState message={extractErrorMessage(error, "Couldn't load SMS settings.")} onRetry={() => void mutate()} />;

  const s = data.settings;
  const current = data.providers.find((p) => p.id === tab)!;
  const active = data.providers.find((p) => p.active);
  const missingDlt = (templates ?? []).filter((t) => t.enabled && !t.dlt_template_id).length;

  return (
    <>
      <PageHeader
        title="SMS setup"
        description="Sign-in codes and booking, payment and payout texts. Everything is the same whatever provider sends them: to switch provider, connect the new one and choose it."
        actions={
          <Link href="/messaging/sms/texts" className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            Texts & DLT templates
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card
            title="Sending"
            description={MODES.find((m) => m.value === s.mode)?.help}
            actions={
              <Badge tone={s.mode === "live" ? "success" : s.mode === "test" ? "warning" : "neutral"} dot>
                {s.mode === "live" ? `Live${active ? ` · ${active.name}` : ""}` : s.mode === "test" ? "Test mode" : "Off"}
              </Badge>
            }
          >
            <Segmented<Mode>
              label="Mode"
              value={s.mode}
              onChange={(mode) => {
                if (!canManage) return;
                if (mode === "live" && missingDlt > 0 && !window.confirm(`${missingDlt} text(s) have no DLT template ID yet. Indian operators block texts without one. Switch to Live anyway?`)) return;
                void patch({ mode }, mode === "live" ? "SMS is live." : mode === "test" ? "Test mode on." : "SMS switched off.");
              }}
              options={MODES.map((m) => ({ value: m.value, label: m.label }))}
            />
            {s.mode === "live" && missingDlt > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <TriangleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {missingDlt} text(s) have no DLT template ID. Fill them in under Texts & DLT templates.
              </p>
            )}
          </Card>

          <Card title="Provider" description="Connect one or more. The one marked “In use” sends everything.">
            <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Providers">
              {data.providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === p.id}
                  onClick={() => setTab(p.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
                    tab === p.id ? "border-accent-500 bg-accent-50 text-accent-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {p.name}
                  {p.active ? <Badge tone="success">In use</Badge> : p.connected ? <Badge tone="info">Connected</Badge> : null}
                </button>
              ))}
            </div>
            <div className="mb-4 text-xs text-slate-500">
              <a href={current.website} target="_blank" rel="noreferrer" className="underline">
                {current.website.replace(/^https:\/\/(www\.)?/, "")}
              </a>
              {current.last_tested_at && (
                <span className="ml-2">
                  · Last test {formatDateTime(current.last_tested_at)}: {current.last_test_ok ? "worked" : `failed (${current.last_test_error})`}
                </span>
              )}
            </div>
            <ProviderForm provider={current} canManage={canManage} onSaved={(o) => void mutate(o, { revalidate: false })} />
            {current.connected && !current.active && canManage && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <Button variant="secondary" disabled={busy} onClick={() => void patch({ active_provider: current.id }, `${current.name} now sends all texts.`)}>
                  <CheckCircle2 aria-hidden className="h-4 w-4" /> Use {current.name} for all texts
                </Button>
              </div>
            )}
            {current.connected && (
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                <div className="font-medium text-slate-700">Delivery reports</div>
                <p className="mt-1">{current.report_setup}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-[11px] text-slate-700 ring-1 ring-slate-200">{data.report_urls[current.id]}</code>
                  <Button size="sm" variant="secondary" onClick={() => copy(data.report_urls[current.id] ?? "", "Address")}>
                    <Copy aria-hidden className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card title="DLT sender details" description="From your DLT registration. They belong to the company and stay the same whatever provider sends.">
            <fieldset disabled={!canManage || busy} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Sender name (header)" value={sender} maxLength={11} placeholder="e.g. HEKENS" hint="The 6-letter name people see as the sender." onChange={(e) => setSender(e.target.value.toUpperCase())} />
                <TextField label="DLT entity ID (PE ID)" value={entity} inputMode="numeric" placeholder="e.g. 1201160000000012345" hint="Your company's ID on the DLT portal." onChange={(e) => setEntity(e.target.value.replace(/[^0-9]/g, ""))} />
              </div>
              <TextField
                className="sm:w-1/2"
                label="Sign-in codes per number per hour"
                type="number"
                min={1}
                max={30}
                value={perHour}
                hint="Stops someone from flooding a number with codes."
                onChange={(e) => setPerHour(e.target.value)}
              />
              <Button variant="primary" onClick={() => void patch({ sender_id: sender || null, dlt_entity_id: entity || null, otp_per_hour: Number(perHour) || 5 }, "Sender details saved.")}>Save</Button>
            </fieldset>
          </Card>

          <Card title="Test numbers" description="In test mode, only these numbers get real texts (once a provider is connected). Everyone else's texts are only logged.">
            <fieldset disabled={!canManage || busy} className="space-y-3">
              <TextAreaField label="Numbers, one per line" rows={3} value={numbers} placeholder={"+91 98765 43210"} onChange={(e) => setNumbers(e.target.value)} />
              <Button
                variant="secondary"
                onClick={() =>
                  void patch(
                    { test_numbers: numbers.split(/[\n,]+/).map((n) => n.trim()).filter(Boolean) },
                    "Test numbers saved.",
                  )
                }
              >
                Save numbers
              </Button>
            </fieldset>
          </Card>

          <Card title="Send a test text" description="Uses example values (Ananya, Sunlit Loft, 27 Nov…). Shows up under Automatic texts.">
            <fieldset disabled={!canManage || busy} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <TextField label="Mobile number" value={testTo} placeholder="+91 98765 43210" onChange={(e) => setTestTo(e.target.value)} />
              <SelectField label="Text" value={testTemplate} onChange={(e) => setTestTemplate(e.target.value)}>
                {(templates ?? [{ key: "auth_otp", name: "Sign-in and verification code" } as Template]).map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                  </option>
                ))}
              </SelectField>
              <Button variant="primary" onClick={() => void sendTest()} disabled={!testTo}>
                <Send aria-hidden className="h-4 w-4" /> Send
              </Button>
            </fieldset>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Sign-in codes"
            actions={<Badge tone={data.sign_in_hook_ready ? "success" : "warning"} dot>{data.sign_in_hook_ready ? "Connected" : "Not connected"}</Badge>}
          >
            <p className="text-sm text-slate-600">
              {data.sign_in_hook_ready
                ? "Supabase hands every sign-in and phone-verification code to us, and it goes out like any other text (or is only logged, in test mode)."
                : "Connect Supabase once so sign-in and phone-verification codes go through here:"}
            </p>
            {!data.sign_in_hook_ready && (
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
                <li>Supabase → Authentication → Sign In / Providers → Phone: switch it on.</li>
                <li>
                  Supabase → Authentication → Hooks → <b>Send SMS hook</b> → HTTPS, with this address, then <b>Generate secret</b> and save:
                </li>
              </ol>
            )}
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-700 ring-1 ring-slate-200">{data.sign_in_hook_url}</code>
              <Button size="sm" variant="secondary" onClick={() => copy(data.sign_in_hook_url, "Address")}>
                <Copy aria-hidden className="h-3.5 w-3.5" />
              </Button>
            </div>
            {data.sign_in_hook_source !== "backend" && canManage && (
              <fieldset disabled={busy} className="mt-4 space-y-2">
                <TextField
                  label={data.sign_in_hook_ready ? "Replace the hook secret" : "3. Paste the hook secret here"}
                  type="password"
                  autoComplete="off"
                  value={hookSecret}
                  placeholder={data.sign_in_hook_ready ? "Saved. Paste a new one to replace it" : "v1,whsec_…"}
                  onChange={(e) => setHookSecret(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" disabled={!hookSecret.trim()} onClick={() => void saveHookSecret(hookSecret)}>
                    Save secret
                  </Button>
                  {data.sign_in_hook_ready && (
                    <Button variant="ghost" size="sm" onClick={() => void saveHookSecret(null)}>
                      Remove
                    </Button>
                  )}
                </div>
              </fieldset>
            )}
            {data.sign_in_hook_source === "backend" && <p className="mt-3 text-xs text-slate-500">The secret is set on the backend (AUTH_SMS_HOOK_SECRET).</p>}
          </Card>
          <Guide
            title="Going live in India (DLT)"
            steps={[
              <>Register the company on a DLT portal (Jio, Airtel, Vi or BSNL). You get an <b>entity ID</b>.</>,
              <>Register a <b>sender name</b> (header), e.g. a 6-letter name of the brand.</>,
              <>
                Register every text. Copy the exact DLT wording from{" "}
                <Link href="/messaging/sms/texts" className="underline">
                  Texts & DLT templates
                </Link>{" "}
                (or download them all as a sheet). Sign-in codes go in as <b>OTP</b>, the rest as <b>Transactional</b> or <b>Service</b>.
              </>,
              <>Paste each approved <b>template ID</b> next to its text, and the sender name and entity ID here.</>,
              <>Connect your provider (and link your DLT registration in their dashboard), send a test to your own number, then switch to <b>Live</b>.</>,
            ]}
          >
            <p className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              DLT matches every text word for word. Change a text&apos;s wording here only after registering the new wording, or operators block it.
            </p>
          </Guide>
        </div>
      </div>
    </>
  );
}
