"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import useSWR from "swr";
import { Eye, EyeOff, ImageIcon, Plus } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { slugify } from "@/lib/slug";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Collection = components["schemas"]["CollectionSummary"];
type CollectionDetail = components["schemas"]["CollectionDetail"];

export default function CollectionsPage() {
  return (
    <Suspense fallback={<AdminShell><Skeleton className="h-64 w-full" /></AdminShell>}>
      <Collections />
    </Suspense>
  );
}

function Collections() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useAdminMe();
  const manage = can("catalog.manage");
  const { data, error, isLoading, mutate } = useSWR("/v1/admin/collections", () => adminApi.GET("/collections").then(unwrap<Collection[]>));
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1" && manage) setCreating(true);
  }, [searchParams, manage]);

  async function create() {
    setBusy(true);
    try {
      const created = await adminApi
        .POST("/collections", { body: { title: title.trim(), slug, description: description.trim(), is_published: false, position: data?.length ?? 0 } })
        .then(unwrap<CollectionDetail>);
      toast.success("Collection created. Add a cover and listings, then publish it.");
      router.push(`/collections/${created.id}`);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not create the collection."));
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <PageHeader
        title="Collections"
        description="Hand-picked sets of listings with a cover — “Beach villas in Goa”, “Studios under ₹5,000/hr”. Shown in the apps once published."
        actions={
          manage && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden className="h-4 w-4" /> New collection
            </Button>
          )
        }
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : error || !data ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load collections.")} onRetry={() => mutate()} />
      ) : data.length === 0 ? (
        <EmptyState title="No collections yet." description="Create one to feature a theme of listings in the apps." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <li key={c.id}>
              <Link
                href={`/collections/${c.id}`}
                className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-slate-100">
                  {c.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                  ) : (
                    <ImageIcon aria-hidden className="h-6 w-6 text-slate-300" />
                  )}
                  <span className="absolute left-2 top-2">
                    {c.is_published ? (
                      <Badge tone="success">
                        <Eye aria-hidden className="mr-1 h-3 w-3" /> Published
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        <EyeOff aria-hidden className="mr-1 h-3 w-3" /> Hidden
                      </Badge>
                    )}
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-slate-900 group-hover:underline">{c.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">/{c.slug}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.description || "No description"}</p>
                  <p className="mt-3 text-xs font-medium text-slate-500">
                    {c.listing_count} listing{c.listing_count === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={setCreating} title="New collection" description="It stays hidden until you publish it.">
        <div className="space-y-4">
          <TextField
            label="Title"
            value={title}
            maxLength={120}
            autoFocus
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Beach villas in Goa"
          />
          <TextField
            label="Slug"
            value={slug}
            maxLength={80}
            hint="Used in links and by the apps, e.g. beach-villas-goa."
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
          <TextAreaField label="Description (optional)" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" disabled={busy || !title.trim() || !slug} onClick={create}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </Dialog>
    </AdminShell>
  );
}
