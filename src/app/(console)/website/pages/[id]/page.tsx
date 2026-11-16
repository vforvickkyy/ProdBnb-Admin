"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useSWR from "swr";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { SeoEditor } from "@/components/website/SeoEditor";
import { MarkdownPreview } from "@/components/website/Markdown";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { adminApi, unwrap } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { fillTokens, slugify, snippet, useSiteUrl, withBrand } from "@/lib/seo";
import { useAdminMe } from "@/lib/useAdminMe";
import { PageStatus, type Placement, type SitePage } from "@/components/website/pages";

interface Draft {
  title: string;
  slug: string;
  placement: Placement;
  body: string;
  is_published: boolean;
}

/** Plain-text first paragraph, for the automatic meta description preview. */
function firstParagraph(markdown: string): string {
  const para =
    fillTokens(markdown)
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith("#") && !p.startsWith("_") && !p.startsWith("|")) ?? "";
  return snippet(para.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`>#]/g, ""));
}

export default function EditWebsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useAdminMe();
  const canEdit = can("content.manage");
  const siteUrl = useSiteUrl();
  const { data, error, isLoading, mutate } = useSWR(`/v1/admin/site/pages/${id}`, () =>
    adminApi.GET("/site/pages/{id}", { params: { path: { id } } }).then(unwrap<SitePage>),
  );

  const initial = useMemo<Draft | null>(
    () => (data ? { title: data.title, slug: data.slug, placement: data.placement, body: data.body, is_published: data.is_published } : null),
    [data],
  );
  const [draft, setDraft] = useState<Draft | null>(initial);
  const [view, setView] = useState<"write" | "preview">("write");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setDraft(initial), [initial]);

  if (isLoading || (!draft && !error)) return <Skeleton className="h-[32rem] w-full rounded-xl" />;
  if (error || !data || !draft) return <ErrorState message={extractErrorMessage(error, "Failed to load the page.")} onRetry={() => mutate()} />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const placeholders = [...new Set(Array.from(draft.body.matchAll(/\[([^\]\n]{2,80})\](?!\()/g), (m) => `[${m[1]}]`))].filter(
    (p) => p !== "[x]" && p !== "[ ]",
  );

  async function patch(body: Record<string, unknown>, success: string, key: string) {
    setBusy(key);
    try {
      await adminApi
        .PATCH("/site/pages/{id}", { params: { path: { id } }, body: { ...body, ...(reason.trim() ? { reason: reason.trim() } : {}) } as never })
        .then(unwrap);
      toast.success(success);
      setReason("");
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save the page."));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const body: Record<string, unknown> = {};
    for (const key of ["title", "slug", "placement", "body", "is_published"] as const) {
      if (draft![key] !== initial![key]) body[key] = draft![key];
    }
    await patch(body, draft!.is_published ? "Saved. The website shows it within a few minutes." : "Saved as a draft.", "save");
  }

  async function remove() {
    setBusy("delete");
    try {
      await adminApi.DELETE("/site/pages/{id}", { params: { path: { id } } }).then(unwrap);
      toast.success("Page deleted.");
      router.push("/website/pages");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not delete the page."));
      setBusy(null);
    }
  }

  return (
    <>
      <Link href="/website/pages" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Pages
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900">{data.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <PageStatus page={data} />
            <span>Edited {formatDateTime(data.updated_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {siteUrl && data.is_published && (
            <a
              href={`${siteUrl}/${data.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 shadow-card hover:bg-slate-50"
            >
              <ExternalLink aria-hidden className="h-3.5 w-3.5" /> View on website
            </a>
          )}
          {canEdit && (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      {data.needs_review && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            <strong>Draft text — needs review.</strong> This was written as a starting point and is not legal advice. Have it checked, fill in
            every blank, then mark it reviewed.
          </span>
          {canEdit && (
            <Button
              onClick={() => void patch({ needs_review: false }, "Marked as reviewed.", "review")}
              disabled={busy !== null || placeholders.length > 0 || dirty}
              title={placeholders.length > 0 ? "Fill in the blanks first" : dirty ? "Save your changes first" : undefined}
            >
              {busy === "review" ? "Saving…" : "Mark as reviewed"}
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card
            title="Content"
            description="Markdown: ## for headings, - for lists, **bold**, [link text](/terms). Use {{brand}} and {{support_email}} instead of typing them."
            actions={
              <Segmented
                label="Editor view"
                value={view}
                onChange={setView}
                options={[
                  { value: "write", label: "Write" },
                  { value: "preview", label: "Preview" },
                ]}
              />
            }
          >
            {view === "write" ? (
              <TextAreaField
                label="Page text"
                rows={24}
                className="font-mono"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                disabled={!canEdit}
                maxLength={100000}
              />
            ) : (
              <div className="min-h-[24rem] rounded-lg border border-slate-200 p-5">
                <h2 className="mb-4 text-xl font-semibold text-slate-900">{draft.title}</h2>
                <MarkdownPreview body={draft.body} />
              </div>
            )}
            {placeholders.length > 0 && (
              <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                <span className="font-medium">Blanks to fill in:</span> {placeholders.join(", ")}
              </div>
            )}
          </Card>

          <Card title="Search & sharing" description="How this page appears in Google and when shared. Empty fields are written automatically.">
            <SeoEditor
              type="page"
              entityKey={data.slug}
              canEdit={canEdit}
              auto={{ title: withBrand(data.title), description: firstParagraph(data.body) || data.title, path: `/${data.slug}` }}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Settings">
            <fieldset disabled={!canEdit} className="space-y-4">
              <TextField label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} />
              <TextField
                label="Address"
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })}
                hint={draft.slug !== data.slug ? "Changing the address breaks old links to this page." : `/${draft.slug}`}
                maxLength={80}
              />
              <SelectField
                label="Where it's linked"
                value={draft.placement}
                onChange={(e) => setDraft({ ...draft, placement: e.target.value as Placement })}
              >
                <option value="company">Footer · Company</option>
                <option value="legal">Footer · Legal</option>
                <option value="hidden">Not in footer</option>
              </SelectField>
              <Switch
                checked={draft.is_published}
                onChange={(checked) => setDraft({ ...draft, is_published: checked })}
                label="Published"
                description="Drafts are only visible here."
              />
            </fieldset>
          </Card>
          {canEdit && (
            <Card>
              <TextField label="Reason (audit log, optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDraft(initial)} disabled={!dirty || busy !== null}>
                  Discard
                </Button>
                <Button variant="primary" onClick={() => void save()} disabled={!dirty || busy !== null || !draft.title.trim() || !draft.slug}>
                  {busy === "save" ? "Saving…" : "Save page"}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${data.title}”?`}
        description="The page and its SEO settings are removed from the website. This can't be undone."
        confirmLabel="Delete page"
        danger
        busy={busy === "delete"}
        onConfirm={() => void remove()}
      />
    </>
  );
}
