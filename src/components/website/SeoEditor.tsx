"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { extractErrorMessage } from "@/components/ui/ErrorState";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { DESCRIPTION_LIMIT, SeoEntityType, SeoValues, snippet, TITLE_LIMIT, useSiteUrl } from "@/lib/seo";

export interface SeoAuto {
  /** The full <title> the website writes when there is no override. */
  title: string;
  description: string;
  /** Path on the website, e.g. /locations/sunlit-loft-mumbai-<id>. */
  path: string;
  /** Image used for shares when there is no override (the cover photo), if any. */
  image?: string | null;
}

export function seoKey(type: SeoEntityType, key: string) {
  return `/v1/admin/site/seo/${type}/${key}`;
}

export function useSeoOverride(type: SeoEntityType, key: string) {
  return useSWR(seoKey(type, key), () =>
    adminApi.GET("/site/seo/{type}/{key}", { params: { path: { type, key } } }).then(unwrap<(SeoValues & { updated_at: string }) | null>),
  );
}

function Counter({ value, limit }: { value: number; limit: number }) {
  return (
    <span className={cn("tabular-nums", value > limit ? "text-amber-700" : "text-slate-500")}>
      {value}/{limit}
    </span>
  );
}

/** How the page would look in Google, from the current (unsaved) values. */
export function SerpPreview({ title, description, url, noindex }: { title: string; description: string; url: string; noindex: boolean }) {
  const shown = title.length > TITLE_LIMIT + 5 ? `${title.slice(0, TITLE_LIMIT + 2).replace(/\s+\S*$/, "")} …` : title;
  return (
    <div className="rounded-lg border border-slate-200 bg-canvas p-4" aria-label="Search result preview">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Google preview</div>
      {noindex ? (
        <p className="text-sm text-slate-500">Hidden from search engines — this page won&apos;t appear in results.</p>
      ) : (
        <>
          <div className="truncate text-xs text-slate-500">{url}</div>
          <div className="mt-1 text-[17px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{shown || "Untitled"}</div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-600">{snippet(description) || "No description yet."}</p>
        </>
      )}
    </div>
  );
}

/**
 * Title, description, share image and "hide from search" for one website page or entity. Empty
 * fields mean "automatic": the website writes them from the listing or page itself.
 */
export function SeoEditor({
  type,
  entityKey,
  auto,
  canEdit,
  onSaved,
}: {
  type: SeoEntityType;
  entityKey: string;
  auto: SeoAuto;
  canEdit: boolean;
  onSaved?: () => void;
}) {
  const siteUrl = useSiteUrl();
  const { data, isLoading, mutate } = useSeoOverride(type, entityKey);
  const initial = useMemo(
    () => ({
      meta_title: data?.meta_title ?? "",
      meta_description: data?.meta_description ?? "",
      og_image_url: data?.og_image_url ?? "",
      noindex: data?.noindex ?? false,
    }),
    [data],
  );
  const [value, setValue] = useState(initial);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(initial), [initial]);

  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  const custom = Boolean(data);
  const title = value.meta_title.trim() || auto.title;
  const description = value.meta_description.trim() || auto.description;
  const base = siteUrl ?? "https://your-site";
  const url = `${base.replace(/^https?:\/\//, "")}${auto.path === "/" ? "" : auto.path.replace(/\//g, " › ").replace(/^ › /, " › ")}`;
  const image = value.og_image_url.trim() || auto.image || null;

  async function save(next = value) {
    setBusy(true);
    try {
      await adminApi
        .PUT("/site/seo/{type}/{key}", {
          params: { path: { type, key: entityKey } },
          body: {
            meta_title: next.meta_title.trim() || null,
            meta_description: next.meta_description.trim() || null,
            og_image_url: next.og_image_url.trim() || null,
            noindex: next.noindex,
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          },
        })
        .then(unwrap);
      toast.success("SEO saved. The website picks it up within a few minutes.");
      setReason("");
      await mutate();
      onSaved?.();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save SEO."));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;

  return (
    <fieldset disabled={!canEdit || busy} className="space-y-5">
      <SerpPreview title={title} description={description} url={url} noindex={value.noindex} />

      <div>
        <TextField
          label="Search title"
          value={value.meta_title}
          onChange={(e) => setValue({ ...value, meta_title: e.target.value })}
          placeholder={auto.title}
          maxLength={120}
          hint="The blue link in Google and the browser tab. Leave empty to use the automatic title shown as the placeholder."
        />
        <div className="mt-1 text-right text-xs">
          <Counter value={value.meta_title.trim().length || auto.title.length} limit={TITLE_LIMIT} />
        </div>
      </div>

      <div>
        <TextAreaField
          label="Meta description"
          rows={3}
          value={value.meta_description}
          onChange={(e) => setValue({ ...value, meta_description: e.target.value })}
          placeholder={auto.description}
          maxLength={320}
          hint="The grey text under the link. Say what's special and who it's for. Leave empty for the automatic one."
        />
        <div className="mt-1 text-right text-xs">
          <Counter value={value.meta_description.trim().length || auto.description.length} limit={DESCRIPTION_LIMIT} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <TextField
          label="Share image (optional)"
          type="url"
          value={value.og_image_url}
          onChange={(e) => setValue({ ...value, og_image_url: e.target.value })}
          placeholder="https://…/image.jpg"
          hint="Shown when the link is shared on WhatsApp, Instagram, X… 1200×630 works best. Empty = the page's own photo."
        />
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="Share image preview" className="h-[63px] w-[120px] rounded-md border border-slate-200 object-cover" />
        )}
      </div>

      <Switch
        checked={value.noindex}
        onChange={(checked) => setValue({ ...value, noindex: checked })}
        label="Hide from search engines"
        description="Adds noindex and leaves the page out of the sitemap. People with the link can still open it."
      />

      {canEdit && (
        <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
          <TextField
            className="min-w-[200px] flex-1"
            label="Reason (audit log, optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
          {custom && (
            <Button
              variant="ghost"
              onClick={() => void save({ meta_title: "", meta_description: "", og_image_url: "", noindex: false })}
              disabled={busy}
            >
              Reset to automatic
            </Button>
          )}
          <Button variant="primary" onClick={() => void save()} disabled={!dirty || busy}>
            {busy ? "Saving…" : "Save SEO"}
          </Button>
        </div>
      )}
      {siteUrl && (
        <a
          href={`${siteUrl}${auto.path}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-700 hover:underline"
        >
          View on website <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </a>
      )}
    </fieldset>
  );
}
