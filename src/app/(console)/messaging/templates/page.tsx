"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import { useInsertTarget, VariableChips } from "@/components/messaging/VariableChips";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Template = components["schemas"]["NotificationTemplate"];
type Category = Template["category"];
type Channel = "in_app" | "push" | "email";

const CATEGORY: Record<Category, string> = {
  new_listing: "New listing",
  new_offer: "Offer",
  casual: "Casual",
  reminder: "Reminder",
  host: "For hosts",
  custom: "Custom",
};

/** Shows {variables} as small highlighted tokens. */
function WithVariables({ text }: { text: string }) {
  const parts = text.split(/(\{[a-z_]+(?:\|[^{}]*)?\})/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\{[a-z_]+/.test(p) ? (
          <span key={i} className="rounded bg-accent-50 px-1 font-mono text-[11px] text-accent-800">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

interface Draft {
  name: string;
  category: Category;
  description: string;
  needs: "" | "listing" | "offer";
  title: string;
  body: string;
  email_subject: string;
  email_body: string;
  channels: Channel[];
}
const EMPTY: Draft = { name: "", category: "custom", description: "", needs: "", title: "", body: "", email_subject: "", email_body: "", channels: ["in_app", "push"] };
const draftOf = (t: Template): Draft => ({
  name: t.name,
  category: t.category,
  description: t.description ?? "",
  needs: t.needs ?? "",
  title: t.title,
  body: t.body,
  email_subject: t.email_subject ?? "",
  email_body: t.email_body ?? "",
  channels: t.channels as Channel[],
});

function TemplateEditor({ open, template, onClose, onSaved }: { open: boolean; template: Template | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setD(template ? draftOf(template) : EMPTY);
  }, [open, template]);
  const set = <K extends keyof Draft>(k: K) => (v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const insert = useInsertTarget(
    {
      title: { value: d.title, set: set("title") },
      body: { value: d.body, set: set("body") },
      email_subject: { value: d.email_subject, set: set("email_subject") },
      email_body: { value: d.email_body, set: set("email_body") },
    },
    "body",
  );
  const email = d.channels.includes("email");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = {
      name: d.name.trim(),
      category: d.category,
      description: d.description.trim() || null,
      needs: d.needs || null,
      title: d.title.trim(),
      body: d.body.trim(),
      email_subject: email ? d.email_subject.trim() || null : null,
      email_body: email ? d.email_body.trim() || null : null,
      channels: d.channels,
    };
    try {
      if (template) unwrap(await adminApi.PATCH("/notification-templates/{templateId}", { params: { path: { templateId: template.id } }, body }));
      else unwrap(await adminApi.POST("/notification-templates", { body }));
      toast.success(template ? "Template saved." : "Template created.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Couldn't save the template."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={template ? `Edit “${template.name}”` : "New template"} description="Wording you can reuse. Variables are filled in for each person when it's sent." width="max-w-xl">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" required maxLength={80} value={d.name} onChange={(e) => set("name")(e.target.value)} />
          <SelectField label="Kind" value={d.category} onChange={(e) => set("category")(e.target.value as Category)}>
            {Object.entries(CATEGORY).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField label="When to use it (optional)" maxLength={300} value={d.description} onChange={(e) => set("description")(e.target.value)} />
        <SelectField label="It's about" value={d.needs} onChange={(e) => set("needs")(e.target.value as Draft["needs"])}>
          <option value="">Nothing in particular</option>
          <option value="listing">A listing (pick it when sending)</option>
          <option value="offer">An offer (pick it when sending)</option>
        </SelectField>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-slate-700">Channels</legend>
          <div className="flex gap-2">
            {(["in_app", "push", "email"] as Channel[]).map((c) => {
              const on = d.channels.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => set("channels")(on ? d.channels.filter((x) => x !== c) : [...d.channels, c])}
                  className={cn("rounded-full border px-3 py-1 text-sm", on ? "border-accent-500 bg-accent-50 text-accent-800" : "border-slate-200 text-slate-700")}
                >
                  {c === "in_app" ? "In-app" : c === "push" ? "Push" : "Email"}
                </button>
              );
            })}
          </div>
        </fieldset>
        <TextField label="Title" required maxLength={160} value={d.title} onChange={(e) => set("title")(e.target.value)} {...insert.bind("title")} />
        <TextAreaField label="Message" required rows={3} maxLength={1000} value={d.body} onChange={(e) => set("body")(e.target.value)} {...insert.bind("body")} />
        <VariableChips onInsert={insert.insert} listing={d.needs === "listing"} offer={d.needs === "offer"} />
        {email && (
          <div className="space-y-4 rounded-lg border border-slate-200 p-4">
            <TextField label="Email subject" maxLength={200} value={d.email_subject} onChange={(e) => set("email_subject")(e.target.value)} {...insert.bind("email_subject")} />
            <TextAreaField label="Email body" rows={6} value={d.email_body} onChange={(e) => set("email_body")(e.target.value)} {...insert.bind("email_body")} hint="Blank line = new paragraph · **bold** · [link](https://…)" />
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving || !d.name.trim() || !d.title.trim() || !d.body.trim() || d.channels.length === 0}>
            {saving ? "Saving…" : template ? "Save template" : "Create template"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

export default function TemplatesPage() {
  const { can } = useAdminMe();
  const canEdit = can("campaigns.send");
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/notification-templates", () => adminApi.GET("/notification-templates").then(unwrap<Template[]>));
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);

  return (
    <>
      <Link href="/messaging" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Announcements
      </Link>
      <PageHeader
        title="Notification templates"
        description="Ready-made wording for new listings, offers and friendly check-ins. Variables like {first_name} are filled in for each person, so one send feels personal to everyone."
        actions={
          canEdit ? (
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus aria-hidden className="h-4 w-4" /> New template
            </Button>
          ) : undefined
        }
      />
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : error || !data ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load templates.")} onRetry={() => mutate()} />
      ) : data.length === 0 ? (
        <EmptyState title="No templates yet" description="Create one to reuse its wording." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((t) => (
            <li key={t.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">{t.name}</h2>
                <Badge tone="neutral">{CATEGORY[t.category]}</Badge>
                {t.needs && <Badge tone="info">Needs {t.needs === "listing" ? "a listing" : "an offer"}</Badge>}
                {t.is_builtin && <span className="text-[11px] text-slate-400">Built-in</span>}
              </div>
              {t.description && <p className="mt-1 text-xs text-slate-500">{t.description}</p>}
              <div className="mt-3 flex-1 rounded-lg bg-slate-50 p-3 text-[13px] leading-5">
                <p className="font-semibold text-slate-900">
                  <WithVariables text={t.title} />
                </p>
                <p className="mt-0.5 text-slate-600">
                  <WithVariables text={t.body} />
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  {t.uses ? `Used ${t.uses} time${t.uses === 1 ? "" : "s"}` : "Not used yet"} · {t.channels.map((c) => (c === "in_app" ? "In-app" : c === "push" ? "Push" : "Email")).join(", ")}
                </span>
                <div className="flex gap-1.5">
                  {canEdit && !t.is_builtin && (
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(t)}>
                      Delete
                    </Button>
                  )}
                  {canEdit && (
                    <Button size="sm" onClick={() => setEditing(t)}>
                      Edit
                    </Button>
                  )}
                  {canEdit && (
                    <Link
                      href={`/messaging/new?template=${t.id}`}
                      className="inline-flex h-7 items-center rounded-lg bg-accent-500 px-2.5 text-xs font-medium text-snow shadow-sm hover:bg-accent-600"
                    >
                      Use
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <TemplateEditor open={editing !== null} template={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="Messages already sent with it aren't affected."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const t = deleting!;
          setDeleting(null);
          try {
            unwrap(await adminApi.DELETE("/notification-templates/{templateId}", { params: { path: { templateId: t.id } } }));
            toast.success("Template deleted.");
            mutate();
          } catch (err) {
            toast.error(extractErrorMessage(err, "Couldn't delete it."));
          }
        }}
      />
    </>
  );
}
