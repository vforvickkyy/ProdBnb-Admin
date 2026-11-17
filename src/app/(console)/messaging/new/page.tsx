"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";
import { ArrowLeft, BellRing, Inbox, LayoutTemplate, Mail, Send, Users } from "lucide-react";
import useSWR from "swr";
import { ListingPicker, loadListing, OfferPicker, type PickedListing } from "@/components/messaging/ContextPickers";
import { PeoplePicker, type Person } from "@/components/messaging/PeoplePicker";
import { SegmentBuilder, type Segment } from "@/components/messaging/SegmentBuilder";
import { useInsertTarget, VariableChips } from "@/components/messaging/VariableChips";
import { useMessagingOverview, type Campaign } from "@/components/messaging/useMessaging";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { renderEmailPreview } from "@/lib/emailPreview";
import { formatCount } from "@/lib/format";
import { BRAND_NAME } from "@/lib/config";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Template = components["schemas"]["NotificationTemplate"];
type Rendered = { title: string; body: string; link_url: string | null; email_subject: string | null; email_body: string | null; user_id: string; missing: string[] };

const usesScope = (texts: string[], scope: "listing" | "offer") => texts.some((t) => new RegExp(`\\{${scope}_[a-z_]+`).test(t));

type Channel = "in_app" | "push" | "email";
type Platform = "ios" | "android" | "web";
type AudienceKind = "all" | "role:host" | "role:booker" | "role:admin" | "platform_users" | "segment" | "users";
type Preview = components["schemas"]["AudiencePreview"];

const AUDIENCES: { value: AudienceKind; label: string; help: string }[] = [
  { value: "all", label: "Everyone", help: "Every active account." },
  { value: "role:host", label: "All hosts", help: "People with the host role." },
  { value: "role:booker", label: "All bookers", help: "People with the booker role." },
  { value: "platform_users", label: "App users on selected platforms", help: "Anyone with the app installed on the platforms you pick below." },
  { value: "segment", label: "A group you choose", help: "By what they do, city, what they shoot, whether they've booked." },
  { value: "role:admin", label: "Admin team", help: "For internal notices." },
  { value: "users", label: "Specific people", help: "Pick recipients by name or email." },
];

function audienceBody(kind: AudienceKind, people: Person[], segment: Segment) {
  if (kind === "all" || kind === "platform_users") return { type: kind };
  if (kind === "segment") return segment;
  if (kind === "users") return { type: "users" as const, user_ids: people.map((p) => p.id) };
  return { type: "role" as const, role: kind.split(":")[1] as "host" | "booker" | "admin" };
}

export default function ComposePage() {
  return (
    <Suspense fallback={<><Skeleton className="h-96 w-full" /></>}>
      <Composer />
    </Suspense>
  );
}

function Composer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");
  const direct = searchParams.get("kind") === "direct";
  const { can } = useAdminMe();
  const overview = useMessagingOverview();

  const [name, setName] = useState("");
  const [audience, setAudience] = useState<AudienceKind>(direct ? "users" : "all");
  const [people, setPeople] = useState<Person[]>([]);
  const [channels, setChannels] = useState<Channel[]>(() => {
    const preset = searchParams.get("channels");
    return preset ? (preset.split(",").filter((c) => ["in_app", "push", "email"].includes(c)) as Channel[]) : ["in_app", "push"];
  });
  const [platforms, setPlatforms] = useState<Platform[]>(["ios", "android", "web"]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"draft" | "send" | "test" | null>(null);
  const [loadedDraft, setLoadedDraft] = useState(!draftId);
  const [segment, setSegment] = useState<Segment>({ type: "segment" });
  const [listing, setListing] = useState<PickedListing | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [previewAs, setPreviewAs] = useState<Person[]>([]);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const templates = useSWR("/v1/admin/notification-templates", () => adminApi.GET("/notification-templates").then(unwrap<Template[]>));
  const insert = useInsertTarget(
    {
      title: { value: title, set: setTitle },
      body: { value: body, set: setBody },
      subject: { value: subject, set: setSubject },
      emailBody: { value: emailBody, set: setEmailBody },
    },
    "body",
  );

  function applyTemplate(t: Template) {
    setTemplateId(t.id);
    setTitle(t.title);
    setBody(t.body);
    setSubject(t.email_subject ?? "");
    setEmailBody(t.email_body ?? "");
    if (t.channels.length) setChannels(t.channels as Channel[]);
    if (!name.trim()) setName(t.name);
    if (t.needs !== "listing") setListing(null);
    if (t.needs !== "offer") setOfferId(null);
  }

  // ?template=<id> starts from that template.
  const templateParam = searchParams.get("template");
  const [appliedParam, setAppliedParam] = useState(false);
  useEffect(() => {
    if (!templateParam || appliedParam || !templates.data) return;
    const t = templates.data.find((x) => x.id === templateParam);
    if (t) applyTemplate(t);
    setAppliedParam(true);
  }, [templateParam, appliedParam, templates.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Editing an existing draft.
  useEffect(() => {
    if (!draftId) return;
    void adminApi
      .GET("/campaigns/{campaignId}", { params: { path: { campaignId: draftId } } })
      .then(unwrap<Campaign>)
      .then((c) => {
        setName(c.name);
        setChannels(c.channels as Channel[]);
        setPlatforms(c.platforms as Platform[]);
        setTitle(c.title);
        setBody(c.body);
        setLink(c.link_url ?? "");
        setSubject(c.email_subject ?? "");
        setEmailBody(c.email_body ?? "");
        const a = c.audience as { type: string; role?: string; user_ids?: string[] };
        setAudience(a.type === "role" ? (`role:${a.role}` as AudienceKind) : (a.type as AudienceKind));
        if (a.type === "segment") setSegment(c.audience as Segment);
        setOfferId(c.coupon_id ?? null);
        setTemplateId(c.template_id ?? null);
        if (c.location_id) void loadListing(c.location_id).then(setListing);
        if (a.type === "users" && a.user_ids?.length) {
          setPeople(a.user_ids.map((id) => ({ id, first_name: null, last_name: id.slice(0, 8), email: null, status: "active", is_host: false, location_count: 0 })));
        }
        setLoadedDraft(true);
      })
      .catch(() => {
        toast.error("Could not load the draft.");
        setLoadedDraft(true);
      });
  }, [draftId]);

  // Don't pre-select a channel that cannot deliver yet: with no push provider connected, start with
  // in-app only (an explicit ?channels= preset or a loaded draft is left alone).
  const [defaultsAdjusted, setDefaultsAdjusted] = useState(false);
  useEffect(() => {
    const r = overview.data?.readiness;
    if (!r || defaultsAdjusted || draftId || searchParams.get("channels")) return;
    setDefaultsAdjusted(true);
    if (!r.push.ios && !r.push.android && !r.push.web) setChannels(["in_app"]);
  }, [overview.data, defaultsAdjusted, draftId, searchParams]);

  const audiencePayload = useMemo(() => audienceBody(audience, people, segment), [audience, people, segment]);
  const audienceReady = audience !== "users" || people.length > 0;

  useEffect(() => {
    if (!audienceReady) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await adminApi
          .POST("/campaigns/audience-preview", { body: { audience: audiencePayload as never, platforms: platforms.length ? platforms : ["ios"] } })
          .then(unwrap<Preview>);
        if (!cancelled) setPreview(result);
      } catch {
        if (!cancelled) setPreview(null);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [audiencePayload, platforms, audienceReady]);

  function toggleChannel(c: Channel) {
    setChannels((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
      // Push always creates the in-app record too.
      return next.includes("push") && !next.includes("in_app") ? [...next, "in_app"] : next;
    });
  }

  const ready = overview.data?.readiness;
  const wantsEmail = channels.includes("email");
  const wantsPush = channels.includes("push");
  const pushReady = ready ? platforms.some((p) => ready.push[p]) : true;
  const problems: string[] = [];
  if (!name.trim()) problems.push("Give it an internal name.");
  if (!audienceReady) problems.push("Pick at least one recipient.");
  if (channels.length === 0) problems.push("Choose at least one channel.");
  if (!title.trim() || !body.trim()) problems.push("Write a title and message.");
  const texts = [title, body, ...(channels.includes("email") ? [subject, emailBody] : [])];
  const needsListing = usesScope(texts, "listing") || templates.data?.find((t) => t.id === templateId)?.needs === "listing";
  const needsOffer = usesScope(texts, "offer") || templates.data?.find((t) => t.id === templateId)?.needs === "offer";
  if (needsListing && !listing) problems.push("Pick the listing it's about.");
  if (needsOffer && !offerId) problems.push("Pick the offer it's about.");
  if (renderError) problems.push(renderError);
  if (wantsEmail && (!subject.trim() || !emailBody.trim())) problems.push("Write the email subject and body.");
  if (wantsEmail && ready && !ready.email) problems.push("Email is not connected yet.");
  if (wantsPush && platforms.length === 0) problems.push("Choose at least one push platform.");
  if (wantsPush && !pushReady) problems.push("No push provider is connected for the chosen platforms.");
  if (link.trim() && !/^(https:\/\/|prodbnb:\/\/)\S+$/.test(link.trim())) problems.push("The link must start with https:// or prodbnb://.");
  if (schedule && (!scheduledAt || new Date(scheduledAt).getTime() < Date.now() + 60_000)) problems.push("Pick a time at least a minute from now.");

  const payload = {
    name: name.trim(),
    kind: audience === "users" ? ("direct" as const) : ("announcement" as const),
    channels,
    platforms: platforms.length ? platforms : (["ios"] as Platform[]),
    audience: audiencePayload,
    title: title.trim(),
    body: body.trim(),
    link_url: link.trim() || null,
    email_subject: wantsEmail ? subject.trim() : null,
    email_body: wantsEmail ? emailBody : null,
    location_id: listing?.id ?? null,
    coupon_id: offerId,
    template_id: templateId,
  };

  // The text as one real person gets it, rendered by the backend (same code as sending).
  const previewUserId = previewAs[0]?.id;
  useEffect(() => {
    if (!title.trim() && !body.trim()) {
      setRendered(null);
      setRenderError(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const res = await adminApi.POST("/campaigns/render-preview", {
        body: {
          title,
          body,
          email_subject: wantsEmail ? subject : null,
          email_body: wantsEmail ? emailBody : null,
          link_url: link.trim() || null,
          location_id: listing?.id ?? null,
          coupon_id: offerId,
          ...(previewUserId ? { user_id: previewUserId } : {}),
        },
      });
      if (cancelled) return;
      if (res.error) {
        const message = (res.error as { error?: { message?: string } }).error?.message ?? "Couldn't preview.";
        // "Pick the listing…" is already listed under the send button; show only other problems.
        setRenderError(/Pick the (listing|offer)/.test(message) ? null : message);
        setRendered(null);
      } else {
        setRenderError(null);
        setRendered((res.data as { data: Rendered }).data);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [title, body, subject, emailBody, wantsEmail, link, listing, offerId, previewUserId]);

  async function saveDraft(): Promise<string> {
    if (draftId) {
      const patch: Partial<typeof payload> = { ...payload };
      delete patch.kind; // fixed at creation
      await adminApi.PATCH("/campaigns/{campaignId}", { params: { path: { campaignId: draftId } }, body: patch as never }).then(unwrap);
      return draftId;
    }
    const created = await adminApi.POST("/campaigns", { body: payload as never }).then(unwrap<Campaign>);
    return created.id;
  }

  async function onSaveDraft() {
    setBusy("draft");
    try {
      const id = await saveDraft();
      toast.success("Draft saved.");
      router.push(`/messaging/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
      setBusy(null);
    }
  }

  async function onSend() {
    setBusy("send");
    try {
      const id = await saveDraft();
      const sent = await adminApi
        .POST("/campaigns/{campaignId}/send", {
          params: { path: { campaignId: id } },
          body: schedule && scheduledAt ? { scheduled_at: new Date(scheduledAt).toISOString() } : {},
        })
        .then(unwrap<Campaign>);
      toast.success(sent.status === "scheduled" ? "Scheduled." : sent.status === "sent" ? "Sent." : "Sending — progress is shown on the next page.");
      router.push(`/messaging/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
      setBusy(null);
    }
  }

  async function onTest() {
    setBusy("test");
    try {
      const result = await adminApi
        .POST("/campaigns/test", {
          body: {
            channels,
            platforms: payload.platforms,
            title: payload.title,
            body: payload.body,
            link_url: payload.link_url,
            email_subject: payload.email_subject,
            email_body: payload.email_body,
            location_id: payload.location_id,
            coupon_id: payload.coupon_id,
          } as never,
        })
        .then(unwrap<{ push?: { outcome: string; sent: number; failed: number }; email?: { ok: boolean; detail: string } }>);
      const parts: string[] = [];
      if (result.push) parts.push(result.push.outcome === "no_devices" ? "Push: you have no registered devices" : `Push: ${result.push.sent} sent, ${result.push.failed} failed`);
      if (result.email) parts.push(`Email: ${result.email.detail}`);
      toast.success(parts.join(" · ") || "Test created in your in-app inbox.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!can("campaigns.send")) {
    return (
      <>
        <PageHeader title="New message" />
        <p className="text-sm text-slate-600">Your team role can view messages but not send them.</p>
      </>
    );
  }
  if (!loadedDraft) {
    return (
      <>
        <Skeleton className="h-96 w-full" />
      </>
    );
  }

  return (
    <>
      <Link href="/messaging" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Announcements
      </Link>
      <PageHeader
        title={draftId ? "Edit draft" : audience === "users" ? "Message specific people" : "New announcement"}
        description="One message, delivered in-app, by push to iOS / Android / web, and by email — to everyone or to chosen people."
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <Card
            title="Start from a template"
            description="Pick one to fill in the wording, then change anything you like."
            actions={
              <Link href="/messaging/templates" className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900">
                <LayoutTemplate aria-hidden className="h-3.5 w-3.5" /> Manage templates
              </Link>
            }
          >
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Template">
              <button
                type="button"
                role="radio"
                aria-checked={!templateId}
                onClick={() => setTemplateId(null)}
                className={cn("rounded-lg border px-3 py-1.5 text-sm", !templateId ? "border-accent-500 bg-accent-50 text-accent-800" : "border-slate-200 text-slate-700 hover:border-slate-300")}
              >
                Blank
              </button>
              {(templates.data ?? []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={templateId === t.id}
                  title={t.description ?? undefined}
                  onClick={() => applyTemplate(t)}
                  className={cn("rounded-lg border px-3 py-1.5 text-sm", templateId === t.id ? "border-accent-500 bg-accent-50 text-accent-800" : "border-slate-200 text-slate-700 hover:border-slate-300")}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </Card>

          {(needsListing || needsOffer || listing || offerId) && (
            <Card title="What it's about" description="Its details fill in the {listing_…} and {offer_…} variables. A message about a listing opens that listing when tapped.">
              <div className="space-y-4">
                {(needsListing || listing) && (
                  <div>
                    <ListingPicker value={listing} onChange={setListing} />
                    {listing?.city && audience !== "users" && (
                      <button
                        type="button"
                        onClick={() => {
                          setAudience("segment");
                          setSegment({ ...segment, type: "segment", cities: [listing.city!] });
                        }}
                        className="mt-2 text-xs font-medium text-accent-700 hover:underline"
                      >
                        Send it to people interested in {listing.city}
                      </button>
                    )}
                  </div>
                )}
                {(needsOffer || offerId) && <OfferPicker value={offerId} onChange={(id) => setOfferId(id)} />}
              </div>
            </Card>
          )}

          <Card title="1 · Audience">
            <TextField className="mb-4" label="Internal name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Diwali offer — hosts" hint="Only admins see this." />
            <fieldset>
              <legend className="sr-only">Who receives it</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {AUDIENCES.map((a) => (
                  <label
                    key={a.value}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                      audience === a.value ? "border-accent-500 bg-accent-50" : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <input type="radio" name="audience" className="mt-1 accent-[#c28014]" checked={audience === a.value} onChange={() => setAudience(a.value)} />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{a.label}</span>
                      <span className="block text-xs text-slate-500">{a.help}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {audience === "users" && (
              <div className="mt-4">
                <PeoplePicker value={people} onChange={setPeople} />
              </div>
            )}
            {audience === "segment" && (
              <div className="mt-4">
                <SegmentBuilder value={segment} onChange={setSegment} />
              </div>
            )}
            {preview && (
              <p className="mt-4 flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700" aria-live="polite">
                <Users aria-hidden className="h-4 w-4 text-slate-500" />
                <span>
                  Reaches <b>{formatCount(preview.users)}</b> people · {formatCount(preview.with_email)} by email · devices: {preview.devices.ios} iOS,{" "}
                  {preview.devices.android} Android, {preview.devices.web} web
                </span>
              </p>
            )}
          </Card>

          <Card title="2 · Channels">
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  { c: "in_app" as Channel, label: "In-app inbox", icon: Inbox, help: "Appears in the app's notifications list." },
                  { c: "push" as Channel, label: "Push notification", icon: BellRing, help: ready && !pushReady ? "No provider connected for these platforms." : "Banner on their phone or browser." },
                  { c: "email" as Channel, label: "Email", icon: Mail, help: ready && !ready.email ? "SMTP not connected yet." : "Sent to their account email." },
                ] as const
              ).map(({ c, label, icon: Icon, help }) => {
                const on = channels.includes(c);
                const locked = c === "in_app" && channels.includes("push");
                return (
                  <button
                    key={c}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={locked}
                    onClick={() => toggleChannel(c)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed",
                      on ? "border-accent-500 bg-accent-50" : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <Icon aria-hidden className={cn("h-4 w-4", on ? "text-accent-700" : "text-slate-400")} />
                    <span className="text-sm font-medium text-slate-900">{label}</span>
                    <span className="text-xs text-slate-500">{locked ? "Included with push." : help}</span>
                  </button>
                );
              })}
            </div>
            {wantsPush && (
              <fieldset className="mt-4">
                <legend className="mb-2 text-sm font-medium text-slate-700">Push to</legend>
                <div className="flex flex-wrap gap-2">
                  {(["ios", "android", "web"] as Platform[]).map((p) => {
                    const on = platforms.includes(p);
                    const connected = ready?.push[p];
                    return (
                      <button
                        key={p}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p) : [...platforms, p])}
                        className={cn("rounded-full border px-3 py-1 text-sm", on ? "border-accent-500 bg-accent-50 text-accent-700" : "border-slate-300 text-slate-700")}
                      >
                        {p === "ios" ? "iOS" : p === "android" ? "Android" : "Web"}
                        {connected === false && <span className="ml-1 text-xs text-amber-800">(not connected)</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {((wantsEmail && ready && !ready.email) || (wantsPush && !pushReady)) && (
              <p className="mt-3 text-xs text-amber-800">
                Connect the missing channel under{" "}
                <Link href={wantsEmail && ready && !ready.email ? "/messaging/email" : "/messaging/push"} className="underline">
                  {wantsEmail && ready && !ready.email ? "Messaging → Email" : "Messaging → Push"}
                </Link>{" "}
                first — there is a step-by-step guide.
              </p>
            )}
          </Card>

          <Card title="3 · Message">
            <div className="space-y-4">
              <TextField label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} hint={`${title.length}/120 — the notification headline.`} {...insert.bind("title")} />
              <TextAreaField label="Message" rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} hint={`${body.length}/1000 — keep it short; push shows ~2 lines.`} {...insert.bind("body")} />
              <VariableChips onInsert={insert.insert} listing={Boolean(listing) || needsListing} offer={Boolean(offerId) || needsOffer} />
              <TextField
                label="Link (optional)"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={listing ? "Leave empty to open the listing" : "https://… or an app link"}
                hint={listing ? "Leave empty and it opens the listing. Also shown as a button in the email." : "Opened when the notification is tapped, and shown as a button in the email."}
              />
              {wantsEmail && (
                <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                  <TextField label="Email subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} {...insert.bind("subject")} />
                  <TextAreaField
                    label="Email body"
                    rows={8}
                    maxLength={50000}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    {...insert.bind("emailBody")}
                    hint="Blank line = new paragraph · **bold** · [link text](https://…). Announcements get an unsubscribe link automatically."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setEmailBody(body ? `${body}\n\n` : emailBody)} disabled={!body}>
                      Copy message into email
                    </Button>
                    {!subject && title && (
                      <Button size="sm" onClick={() => setSubject(title)}>
                        Use title as subject
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="4 · Send">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="accent-[#c28014]" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
                Schedule for later
              </label>
              {schedule && (
                <div>
                  <input
                    type="datetime-local"
                    aria-label="Send at"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900"
                  />
                  {overview.data && !overview.data.jobs.enabled && (
                    <p className="mt-2 text-xs text-amber-800">
                      Background sending is off, so scheduled messages will not go out on their own. Turn it on in{" "}
                      <Link href="/messaging#delivery" className="underline">
                        Announcements → Delivery engine
                      </Link>
                      .
                    </p>
                  )}
                </div>
              )}
              {problems.length > 0 && (
                <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-500" aria-label="Before you can send">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="brand" disabled={problems.length > 0 || busy !== null} onClick={onSend}>
                  <Send aria-hidden className="h-4 w-4" /> {busy === "send" ? "Sending…" : schedule ? "Schedule" : preview ? `Send to ${formatCount(preview.users)}` : "Send"}
                </Button>
                <Button disabled={!title.trim() || !body.trim() || channels.length === 0 || busy !== null || (wantsEmail && (!subject || !emailBody))} onClick={onTest}>
                  {busy === "test" ? "Sending test…" : "Send test to me"}
                </Button>
                <Button variant="ghost" disabled={!name.trim() || !title.trim() || !body.trim() || !audienceReady || busy !== null} onClick={onSaveDraft}>
                  Save draft
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <aside className="xl:col-span-2" aria-label="Preview">
          <div className="sticky top-20 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Preview</h2>
              <span className="text-xs text-slate-500">{previewAs[0] ? `As ${previewAs[0].first_name ?? previewAs[0].email ?? "them"}` : "As you"}</span>
            </div>
            <details className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <summary className="cursor-pointer text-slate-600">Preview as someone else</summary>
              <div className="mt-2">
                <PeoplePicker value={previewAs} onChange={(p) => setPreviewAs(p.slice(-1))} />
              </div>
            </details>
            {rendered && rendered.missing.length > 0 && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                This person hasn&apos;t given their {rendered.missing.map((m) => m.replace(/_/g, " ")).join(", ")}, so the fallback is used.
              </p>
            )}
            <div className="rounded-[2rem] border-8 border-ink-900 bg-[#0b0f17] p-4">
              <div className="rounded-2xl bg-white/90 p-3 shadow-lg backdrop-blur" style={{ background: "rgba(255,255,255,0.92)" }}>
                <div className="flex items-center gap-2 text-[11px] text-[#475569]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#c28014] text-[10px] font-bold text-snow">{BRAND_NAME.slice(0, 1).toUpperCase()}</span>
                  {BRAND_NAME.toUpperCase()} · now
                </div>
                <p className="mt-1.5 text-sm font-semibold text-[#0f172a]">{rendered?.title || title || "Notification title"}</p>
                <p className="line-clamp-3 text-[13px] text-[#334155]">{rendered?.body || body || "Your message appears here."}</p>
              </div>
            </div>
            {wantsEmail && (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
                  <b>Subject:</b> {rendered?.email_subject || subject || "—"}
                </div>
                <div className="bg-[#f4f4f5] p-4">
                  <div className="rounded-lg bg-white p-5 text-[14px] text-[#18181b]">
                    <p className="mb-4 text-base font-bold">{BRAND_NAME}</p>
                    <div dangerouslySetInnerHTML={{ __html: renderEmailPreview(rendered?.email_body || emailBody || "Your email body appears here.") }} />
                    {(rendered?.link_url ?? link).startsWith("https://") && (
                      <p className="mt-4">
                        <span className="inline-block rounded-lg bg-[#c28014] px-4 py-2 text-sm font-semibold text-snow">Open</span>
                      </p>
                    )}
                    {audience !== "users" && <p className="mt-4 text-xs text-[#6b7280]">Unsubscribe from announcements</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
