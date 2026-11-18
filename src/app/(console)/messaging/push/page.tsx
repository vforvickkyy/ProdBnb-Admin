"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";
import { Copy, FileUp, KeyRound, Lock, Send } from "lucide-react";
import { ChannelStatusCard, Guide } from "@/components/messaging/ChannelCard";
import { useMessagingOverview, type ChannelStatus } from "@/components/messaging/useMessaging";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { TabPanel, Tabs } from "@/components/ui/Tabs";
import { adminApi, unwrap } from "@/lib/api";
import { useAdminMe } from "@/lib/useAdminMe";
import { BRAND_NAME } from "@/lib/config";

type Tab = "ios" | "android" | "web";

export default function PushSetupPage() {
  return (
    <Suspense fallback={<><Skeleton className="h-96 w-full" /></>}>
      <PushSetup />
    </Suspense>
  );
}

function PushSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (["ios", "android", "web"].includes(searchParams.get("tab") ?? "") ? searchParams.get("tab") : "ios") as Tab;
  const { can } = useAdminMe();
  const overview = useMessagingOverview();
  const channels = overview.data?.channels ?? [];
  const find = (c: string) => channels.find((x) => x.channel === c);
  const canManage = can("channels.manage");

  return (
    <>
      <PageHeader
        title="Push notifications"
        description="Connect Apple, Google and browser push so announcements and direct messages reach phones and browsers."
        actions={
          can("campaigns.send") && (
            <Link
              href="/messaging/new?kind=direct&channels=in_app,push"
              className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-accent-500 px-3 text-[13px] font-medium text-snow shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send aria-hidden className="h-4 w-4" /> Push to specific people
            </Link>
          )
        }
      />
      {overview.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : overview.error || !overview.data ? (
        <ErrorState message={extractErrorMessage(overview.error, "Failed to load.")} onRetry={() => overview.mutate()} />
      ) : (
        <>
          <Tabs<Tab>
            label="Platform"
            value={tab}
            onChange={(t) => router.replace(`/messaging/push?tab=${t}`, { scroll: false })}
            items={[
              { value: "ios", label: `iOS · ${overview.data.devices.ios}` },
              { value: "android", label: `Android · ${overview.data.devices.android}` },
              { value: "web", label: `Web · ${overview.data.devices.web}` },
            ]}
          />
          {tab === "ios" && find("apns") && (
            <TabPanel value="ios">
              <ApnsSetup status={find("apns")!} canManage={canManage} onChanged={() => overview.mutate()} />
            </TabPanel>
          )}
          {tab === "android" && find("fcm") && (
            <TabPanel value="android">
              <FcmSetup status={find("fcm")!} canManage={canManage} onChanged={() => overview.mutate()} />
            </TabPanel>
          )}
          {tab === "web" && find("webpush") && (
            <TabPanel value="web">
              <WebPushSetup status={find("webpush")!} canManage={canManage} onChanged={() => overview.mutate()} />
            </TabPanel>
          )}
        </>
      )}
    </>
  );
}

async function saveChannel(channel: "apns" | "fcm" | "webpush", body: Record<string, unknown>, onChanged: () => void, success: string) {
  try {
    await adminApi.PUT("/messaging/channels/{channel}", { params: { path: { channel } }, body: { channel, ...body } as never }).then(unwrap);
    toast.success(success);
    onChanged();
    return true;
  } catch (e) {
    toast.error(extractErrorMessage(e, "Could not save."));
    return false;
  }
}

function FilePick({ accept, label, onText }: { accept: string; label: string; onText: (text: string, name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="sm" onClick={() => ref.current?.click()}>
        <FileUp aria-hidden className="h-3.5 w-3.5" /> {label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onText(await file.text(), file.name);
          e.target.value = "";
        }}
      />
    </>
  );
}

const SECRET_NOTE = (
  <p className="flex items-start gap-2 text-xs text-slate-500">
    <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
    Keys are encrypted in Supabase Vault and never shown again. Leave the key empty to keep the stored one when you change other fields.
  </p>
);

function ApnsSetup({ status, canManage, onChanged }: { status: ChannelStatus; canManage: boolean; onChanged: () => void }) {
  const config = status.config as Record<string, string>;
  const [teamId, setTeamId] = useState("");
  const [keyId, setKeyId] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTeamId(config.team_id ?? "");
    setKeyId(config.key_id ?? "");
    setBundleId(config.bundle_id ?? "");
    setEnvironment(config.environment ?? "production");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.updated_at, status.source]);

  const needsKey = status.source !== "dashboard";
  const valid = /^[A-Z0-9]{10}$/.test(teamId) && /^[A-Z0-9]{10}$/.test(keyId) && bundleId.trim().length > 2 && (!needsKey || key.includes("PRIVATE KEY"));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <ChannelStatusCard status={status} canManage={canManage} onChanged={onChanged} testLabel="Test (sends to your own iPhone if registered)">
          {status.source === "environment" && (
            <p className="text-sm text-slate-600">
              Using the backend&apos;s APNS_* environment variables. Saving a key here takes over from them — handy for rotating keys without a deploy.
            </p>
          )}
          {!status.connected && <p className="text-sm text-slate-600">Not connected. iOS devices are registered but get no push until you connect APNs.</p>}
        </ChannelStatusCard>
        <Card title="Apple Push Notification service (APNs)">
          <fieldset disabled={!canManage} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Team ID" value={teamId} maxLength={10} onChange={(e) => setTeamId(e.target.value.toUpperCase())} placeholder="A1B2C3D4E5" />
              <TextField label="Key ID" value={keyId} maxLength={10} onChange={(e) => setKeyId(e.target.value.toUpperCase())} placeholder="XYZ123ABCD" />
              <SelectField label="Default environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                <option value="production">Production (App Store, TestFlight)</option>
                <option value="sandbox">Sandbox (Xcode builds)</option>
              </SelectField>
            </div>
            <TextField label="Bundle ID" value={bundleId} onChange={(e) => setBundleId(e.target.value)} placeholder="com.eastape.prodbnbapp" />
            <TextAreaField
              label="Auth key (.p8)"
              rows={5}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={needsKey ? "-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----" : "•••••••• saved — leave blank to keep"}
            />
            <div className="flex flex-wrap items-center gap-2">
              <FilePick accept=".p8,text/plain" label="Load .p8 file" onText={(t) => setKey(t)} />
              {canManage && (
                <Button
                  variant="primary"
                  disabled={busy || !valid}
                  onClick={async () => {
                    setBusy(true);
                    const ok = await saveChannel(
                      "apns",
                      { team_id: teamId, key_id: keyId, bundle_id: bundleId.trim(), environment, ...(key ? { private_key: key } : {}) },
                      onChanged,
                      "APNs connected."
                    );
                    if (ok) setKey("");
                    setBusy(false);
                  }}
                >
                  {status.source === "dashboard" ? "Save changes" : "Connect APNs"}
                </Button>
              )}
            </div>
            {SECRET_NOTE}
          </fieldset>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Guide
          title="Get your APNs key"
          steps={[
            <>
              Sign in to <b>developer.apple.com</b> → Certificates, Identifiers &amp; Profiles → <b>Keys</b> → “+”.
            </>,
            <>
              Name it “{BRAND_NAME} push”, tick <b>Apple Push Notifications service (APNs)</b>, continue and register.
            </>,
            <>
              <b>Download the .p8 file</b> — Apple lets you download it only once. Note the <b>Key ID</b> shown with it.
            </>,
            <>
              Your <b>Team ID</b> is at the top right of the developer portal (Membership details).
            </>,
            <>
              The <b>Bundle ID</b> is the iOS app&apos;s identifier (Xcode → target → General).
            </>,
            <>
              Paste or load the .p8, fill the fields, <b>Connect</b>, then <b>Test</b>. One key works for both sandbox and production; each device&apos;s own
              environment is used automatically.
            </>,
          ]}
        />
      </div>
    </div>
  );
}

function FcmSetup({ status, canManage, onChanged }: { status: ChannelStatus; canManage: boolean; onChanged: () => void }) {
  const config = status.config as Record<string, string>;
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);
  let parsedProject: string | null = null;
  try {
    parsedProject = json ? ((JSON.parse(json) as { project_id?: string }).project_id ?? null) : null;
  } catch {
    parsedProject = null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <ChannelStatusCard status={status} canManage={canManage} onChanged={onChanged} testLabel="Test (checks the key; sends to your Android device if registered)">
          {status.connected ? (
            <p className="text-sm text-slate-700">
              Project <b>{config.project_id}</b> · service account {config.client_email}
            </p>
          ) : (
            <p className="text-sm text-slate-600">Not connected. The Android app isn&apos;t live yet — connect this before it launches so push works on day one.</p>
          )}
        </ChannelStatusCard>
        <Card title="Firebase Cloud Messaging (FCM)">
          <fieldset disabled={!canManage} className="space-y-4">
            <TextAreaField
              label="Service account JSON"
              rows={7}
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder={status.connected ? "•••••••• saved — paste a new file to replace it" : '{ "type": "service_account", "project_id": "…", … }'}
              hint={parsedProject ? `Firebase project: ${parsedProject}` : undefined}
            />
            <div className="flex flex-wrap items-center gap-2">
              <FilePick accept=".json,application/json" label="Load JSON file" onText={(t) => setJson(t)} />
              {canManage && (
                <Button
                  variant="primary"
                  disabled={busy || !parsedProject}
                  onClick={async () => {
                    setBusy(true);
                    const ok = await saveChannel("fcm", { service_account_json: json }, onChanged, "FCM connected.");
                    if (ok) setJson("");
                    setBusy(false);
                  }}
                >
                  {status.connected ? "Replace key" : "Connect FCM"}
                </Button>
              )}
            </div>
            {SECRET_NOTE}
          </fieldset>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Guide
          title="Get your Firebase key"
          steps={[
            <>
              Open <b>console.firebase.google.com</b> and create (or open) the {BRAND_NAME} project; add the Android app with its package name.
            </>,
            <>
              Project settings → <b>Cloud Messaging</b>: make sure <b>Firebase Cloud Messaging API (V1)</b> is enabled.
            </>,
            <>
              Project settings → <b>Service accounts</b> → <b>Generate new private key</b>. A JSON file downloads.
            </>,
            <>
              Load that file here and <b>Connect</b>. Store it nowhere else — anyone with it can send push to your users.
            </>,
            <>
              <b>Test</b> confirms Google accepts the key. End-to-end delivery can be tested once the Android app registers a device.
            </>,
          ]}
        />
      </div>
    </div>
  );
}

function WebPushSetup({ status, canManage, onChanged }: { status: ChannelStatus; canManage: boolean; onChanged: () => void }) {
  const config = status.config as Record<string, string>;
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState<"generate" | "paste">("generate");
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSubject(config.subject ?? "mailto:");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.updated_at]);

  const subjectValid = /^(mailto:\S+@\S+|https:\/\/\S+)$/.test(subject.trim());

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <ChannelStatusCard status={status} canManage={canManage} onChanged={onChanged} testLabel="Test (checks the keys; sends to your browser if subscribed)">
          {status.connected ? (
            <div className="space-y-2 text-sm text-slate-700">
              <p>Contact: {config.subject}</p>
              <div>
                <p className="text-xs text-slate-500">Public key — the web app subscribes with this (also served at GET /v1/push/web/public-key):</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-xs">{config.public_key}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Copy public key"
                    onClick={() => {
                      void navigator.clipboard?.writeText(config.public_key ?? "");
                      toast.success("Copied.");
                    }}
                  >
                    <Copy aria-hidden className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Not connected. Generate keys now so the web app can use them from its first release.</p>
          )}
        </ChannelStatusCard>
        <Card title="Web Push (VAPID)">
          <fieldset disabled={!canManage} className="space-y-4">
            <TextField
              label="Contact (subject)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              hint="mailto:ops@yourdomain.com or https://yourdomain.com — browser push services contact this if something goes wrong."
            />
            <SelectField label="Keys" value={mode} onChange={(e) => setMode(e.target.value as never)}>
              <option value="generate">{status.connected ? "Keep current keys (or generate new — breaks existing subscriptions)" : "Generate a new key pair"}</option>
              <option value="paste">Paste an existing key pair</option>
            </SelectField>
            {mode === "paste" && (
              <div className="grid gap-4">
                <TextField label="Public key" value={publicKey} onChange={(e) => setPublicKey(e.target.value.trim())} />
                <TextField label="Private key" type="password" value={privateKey} onChange={(e) => setPrivateKey(e.target.value.trim())} autoComplete="off" />
              </div>
            )}
            {canManage && (
              <div className="flex flex-wrap gap-2">
                {status.connected && (
                  <Button
                    disabled={busy || !subjectValid}
                    onClick={async () => {
                      setBusy(true);
                      await saveChannel("webpush", { subject: subject.trim() }, onChanged, "Saved.");
                      setBusy(false);
                    }}
                  >
                    Save contact
                  </Button>
                )}
                <Button
                  variant="primary"
                  disabled={busy || !subjectValid || (mode === "paste" && (!publicKey || !privateKey))}
                  onClick={async () => {
                    setBusy(true);
                    const ok = await saveChannel(
                      "webpush",
                      mode === "generate" ? { subject: subject.trim(), generate_keys: true } : { subject: subject.trim(), public_key: publicKey, private_key: privateKey },
                      onChanged,
                      mode === "generate" ? "New VAPID keys generated." : "Web Push connected."
                    );
                    if (ok) {
                      setPublicKey("");
                      setPrivateKey("");
                    }
                    setBusy(false);
                  }}
                >
                  <KeyRound aria-hidden className="h-4 w-4" /> {mode === "generate" ? (status.connected ? "Generate new keys" : "Generate keys & connect") : "Connect"}
                </Button>
              </div>
            )}
            {SECRET_NOTE}
          </fieldset>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Guide
          title="How web push works"
          steps={[
            <>
              <b>Generate keys</b> here once. The private key stays encrypted in Vault; the public key is shared with the web app.
            </>,
            <>
              The web app asks the visitor for permission, subscribes with the public key, and registers the subscription with{" "}
              <code className="text-xs">POST /v1/devices</code> (platform “web”).
            </>,
            <>
              From then on, announcements with <b>Web</b> selected reach that browser — even when {BRAND_NAME} isn&apos;t open.
            </>,
            <>
              <b>Don&apos;t regenerate keys</b> once the web app is live: every existing browser subscription would stop working.
            </>,
          ]}
        />
      </div>
    </div>
  );
}
