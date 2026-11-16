"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useSWR from "swr";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { SelectField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useRouter } from "@/lib/navigation";
import { slugify, useSiteUrl } from "@/lib/seo";
import { useAdminMe } from "@/lib/useAdminMe";
import { ContactEmailCard } from "@/components/website/ContactEmailCard";
import { PageStatus, PLACEMENT_LABEL, type Placement, type SitePage } from "@/components/website/pages";

function NewPageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [placement, setPlacement] = useState<Placement>("company");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const page = await adminApi.POST("/site/pages", { body: { title: title.trim(), slug, placement, body: "" } }).then(unwrap<SitePage>);
      toast.success("Page created as a draft.");
      onOpenChange(false);
      router.push(`/website/pages/${page.id}`);
    } catch (err) {
      setError(extractErrorMessage(err, "Could not create the page."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New page"
      description="Pages start as drafts. Write the text, then publish."
    >
      <div className="space-y-4">
        <TextField
          label="Title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="e.g. Safety guidelines"
          maxLength={120}
          autoFocus
        />
        <TextField
          label="Address"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          hint={slug ? `The page will live at /${slug}` : "Lower-case words joined by hyphens."}
          maxLength={80}
        />
        <SelectField label="Where it's linked" value={placement} onChange={(e) => setPlacement(e.target.value as Placement)}>
          <option value="company">Footer · Company</option>
          <option value="legal">Footer · Legal</option>
          <option value="hidden">Not in footer (link to it yourself)</option>
        </SelectField>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={busy || !title.trim() || !slug}>
            {busy ? "Creating…" : "Create page"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export default function WebsitePagesPage() {
  const { can } = useAdminMe();
  const canEdit = can("content.manage");
  const siteUrl = useSiteUrl();
  const [creating, setCreating] = useState(false);
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/site/pages", () => adminApi.GET("/site/pages").then(unwrap<SitePage[]>));

  const groups: Placement[] = ["company", "legal", "hidden"];
  const pending = (data ?? []).filter((p) => p.is_published && (p.needs_review || p.placeholders.length > 0)).length;

  return (
    <>
      <PageHeader
        title="Pages"
        description="Policies and company pages linked from the website's footer. Text is Markdown; {{brand}} and {{support_email}} are filled in automatically."
        actions={
          canEdit && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden className="h-4 w-4" /> New page
            </Button>
          )
        }
      />
      {pending > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{pending} published page{pending === 1 ? " needs" : "s need"} attention.</strong> The policies were seeded as drafts with blanks
          like <em>[Company legal name]</em>. Fill them in and have a lawyer review the policies before launch, then mark each page as
          reviewed.
        </div>
      )}
      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : error || !data ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load pages.")} onRetry={() => mutate()} />
      ) : data.length === 0 ? (
        <EmptyState title="No pages yet" description="Create your first page, for example a privacy policy." />
      ) : (
        <div className="space-y-6">
          {groups.map((placement) => {
            const pages = data.filter((p) => p.placement === placement);
            if (pages.length === 0) return null;
            return (
              <Card key={placement} title={PLACEMENT_LABEL[placement]}>
                <ul className="-my-2 divide-y divide-slate-200">
                  {pages.map((page) => (
                    <li key={page.id}>
                      <Link
                        href={`/website/pages/${page.id}`}
                        className="flex flex-wrap items-center gap-3 rounded-md py-3 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 sm:flex-nowrap"
                      >
                        <FileText aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">{page.title}</div>
                          <div className="truncate text-xs text-slate-500">
                            {siteUrl ? siteUrl.replace(/^https?:\/\//, "") : ""}/{page.slug} · edited {formatDateTime(page.updated_at)}
                          </div>
                        </div>
                        <PageStatus page={page} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
          <ContactEmailCard canEdit={canEdit} />
        </div>
      )}
      <NewPageDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
