"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Lock, Send } from "lucide-react";
import { ChannelStatusCard, Guide } from "@/components/messaging/ChannelCard";
import { useMessagingOverview } from "@/components/messaging/useMessaging";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { SelectField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { useAdminMe } from "@/lib/useAdminMe";
import { BRAND_NAME } from "@/lib/config";

interface Preset {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  note: string;
}

const PRESETS: Preset[] = [
  { id: "custom", label: "Other / custom SMTP", host: "", port: 587, secure: false, note: "Use the SMTP details your email provider gives you." },
  {
    id: "resend",
    label: "Resend (recommended)",
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    note: "Username: resend. Password: a Resend API key (resend.com → API Keys). From address must be on a domain verified in Resend, e.g. bookings@notify.yourdomain.com.",
  },
  {
    id: "gmail",
    label: "Google Workspace / Gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    note: "Username is the full address. Password must be an App Password (Google Account → Security → 2-Step Verification → App passwords), not the normal password. Limit ~2,000/day on Workspace, 500/day on Gmail.",
  },
  {
    id: "zoho",
    label: "Zoho Mail (India)",
    host: "smtp.zoho.in",
    port: 465,
    secure: true,
    note: "Username is the full address. Create an app-specific password in Zoho → Security if 2FA is on.",
  },
  {
    id: "ses",
    label: "Amazon SES (Mumbai)",
    host: "email-smtp.ap-south-1.amazonaws.com",
    port: 587,
    secure: false,
    note: "Create SMTP credentials in SES → SMTP settings (they differ from your AWS keys). Verify the sending domain and request production access first.",
  },
  { id: "brevo", label: "Brevo", host: "smtp-relay.brevo.com", port: 587, secure: false, note: "Username is your Brevo login; password is the SMTP key from Brevo → SMTP & API." },
  { id: "resend", label: "Resend", host: "smtp.resend.com", port: 465, secure: true, username: "resend", note: "Username is literally “resend”; password is an API key. Verify your domain in Resend first." },
  { id: "postmark", label: "Postmark", host: "smtp.postmarkapp.com", port: 587, secure: false, note: "Username and password are both your Server API token." },
];

export default function EmailSetupPage() {
  const { can } = useAdminMe();
  const canManage = can("channels.manage");
  const overview = useMessagingOverview();
  const status = overview.data?.channels.find((c) => c.channel === "smtp");
  const config = (status?.config ?? {}) as Record<string, unknown>;

  const [preset, setPreset] = useState("custom");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState(BRAND_NAME);
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [newsFrom, setNewsFrom] = useState("");
  const [rate, setRate] = useState("60");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status?.connected) {
      setHost(String(config.host ?? ""));
      setPort(String(config.port ?? 587));
      setSecure(Boolean(config.secure));
      setUsername(String(config.username ?? ""));
      setFromName(String(config.from_name ?? BRAND_NAME));
      setFromEmail(String(config.from_email ?? ""));
      setReplyTo(String(config.reply_to ?? ""));
      setNewsFrom(String(config.marketing_from_email ?? ""));
      setRate(String(config.max_per_minute ?? 60));
      setPreset(PRESETS.find((p) => p.host === config.host)?.id ?? "custom");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.updated_at, status?.connected]);

  function applyPreset(id: string) {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p && p.id !== "custom") {
      setHost(p.host);
      setPort(String(p.port));
      setSecure(p.secure);
      if (p.username) setUsername(p.username);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await adminApi
        .PUT("/messaging/channels/{channel}", {
          params: { path: { channel: "smtp" } },
          body: {
            channel: "smtp",
            host: host.trim(),
            port: Number(port),
            secure,
            username: username.trim() || null,
            ...(password ? { password } : {}),
            from_email: fromEmail.trim(),
            from_name: fromName.trim(),
            reply_to: replyTo.trim() || null,
            marketing_from_email: newsFrom.trim() || null,
            max_per_minute: Number(rate) || 60,
          },
        })
        .then(unwrap);
      setPassword("");
      toast.success("Email connected. Send a test to confirm it works.");
      await overview.mutate();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not save."));
    } finally {
      setBusy(false);
    }
  }

  const presetNote = PRESETS.find((p) => p.id === preset)?.note;
  const valid = host.trim() && Number(port) > 0 && fromEmail.includes("@") && fromName.trim() && (status?.connected || password);

  return (
    <>
      <PageHeader
        title="Email"
        description={`Connect the mailbox ${BRAND_NAME} sends announcements and direct emails from.`}
        actions={
          can("campaigns.send") && (
            <Link
              href="/messaging/new?kind=direct&channels=email"
              className="inline-flex items-center gap-1.5 h-8 rounded-lg bg-accent-500 px-3 text-[13px] font-medium text-snow shadow-sm transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send aria-hidden className="h-4 w-4" /> Email specific people
            </Link>
          )
        }
      />
      {overview.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : overview.error || !status ? (
        <ErrorState message={extractErrorMessage(overview.error, "Failed to load.")} onRetry={() => overview.mutate()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <ChannelStatusCard status={status} canManage={canManage} onChanged={() => overview.mutate()} testLabel="Send test email" testTo={testTo || undefined}>
              {status.connected ? (
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    Sending as <b>{String(config.from_name)}</b> &lt;{String(config.from_email)}&gt; via {String(config.host)}:{String(config.port)} · up to{" "}
                    {String(config.max_per_minute)} emails/minute.
                  </p>
                  {canManage && <TextField label="Send the test to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Leave empty to send to yourself" />}
                </div>
              ) : (
                <p className="text-sm text-slate-600">Not connected yet. Fill in the form below — the guide on the right walks through it.</p>
              )}
            </ChannelStatusCard>

            <Card title={status.connected ? "SMTP settings" : "Connect SMTP"}>
              <fieldset disabled={!canManage} className="space-y-4">
                <SelectField label="Provider" value={preset} onChange={(e) => applyPreset(e.target.value)}>
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </SelectField>
                {presetNote && <p className="-mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{presetNote}</p>}
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField className="sm:col-span-2" label="SMTP host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" />
                  <TextField label="Port" inputMode="numeric" value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))} />
                </div>
                <SelectField label="Security" value={secure ? "ssl" : "starttls"} onChange={(e) => setSecure(e.target.value === "ssl")}>
                  <option value="ssl">SSL/TLS (usually port 465)</option>
                  <option value="starttls">STARTTLS (usually port 587)</option>
                </SelectField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={status.connected ? "•••••••• saved — leave blank to keep" : ""}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="From name" value={fromName} onChange={(e) => setFromName(e.target.value)} />
                  <TextField label="From address" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hello@yourdomain.com" />
                  <TextField label="Reply-to (optional)" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="support@yourdomain.com" />
                  <TextField
                    label="News & offers sender (optional)"
                    type="email"
                    value={newsFrom}
                    onChange={(e) => setNewsFrom(e.target.value)}
                    placeholder="news@news.yourdomain.com"
                    hint="Announcements go out from this address, so they never affect booking emails."
                  />
                  <TextField
                    label="Max emails per minute"
                    inputMode="numeric"
                    value={rate}
                    onChange={(e) => setRate(e.target.value.replace(/\D/g, ""))}
                    hint="Stay under your provider's limit."
                  />
                </div>
                <p className="flex items-start gap-2 text-xs text-slate-500">
                  <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  The password is encrypted in Supabase Vault and never shown again — not here, not in the API, not in the audit log.
                </p>
                {canManage && (
                  <Button variant="primary" disabled={busy || !valid} onClick={save}>
                    {busy ? "Saving…" : status.connected ? "Save changes" : "Connect email"}
                  </Button>
                )}
              </fieldset>
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <Guide
              title="Setup guide"
              steps={[
                <>
                  <b>Use an address on your own domain</b> (e.g. hello@yourdomain.com). Free webmail “from” addresses are often rejected by Gmail and Outlook.
                </>,
                <>
                  <b>Pick a provider.</b> For a few hundred emails a day, Google Workspace or Zoho is fine. For announcements to all users, use a sending
                  service like Amazon SES, Brevo, Resend or Postmark — they are built for volume.
                </>,
                <>
                  <b>Authenticate your domain</b> in that provider: add the SPF, DKIM and DMARC DNS records it shows you. Without them, announcements land in spam.
                </>,
                <>
                  <b>Create SMTP credentials</b> (an app password or SMTP key — never your main account password) and choose the provider in the form; host,
                  port and security fill in.
                </>,
                <>
                  <b>Connect, then Send test email.</b> Check it arrives in the inbox (not spam) and that the From name looks right.
                </>,
                <>
                  <b>Set “Max emails per minute”</b> below your provider’s limit. Big announcements are sent steadily in the background at that rate — turn
                  on the{" "}
                  <Link href="/messaging#delivery" className="underline">
                    delivery engine
                  </Link>{" "}
                  for that.
                </>,
              ]}
            >
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                Every announcement email includes a one-click unsubscribe link (required by Gmail and Yahoo for bulk senders). Unsubscribed people still get
                direct emails you send them and emails about their own bookings.
              </div>
            </Guide>
          </div>
        </div>
      )}
    </>
  );
}
