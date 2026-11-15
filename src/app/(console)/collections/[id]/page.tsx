"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "@/lib/navigation";
import { toast } from "sonner";
import useSWR from "swr";
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, ImageIcon, X } from "lucide-react";
import { CoverUploader } from "@/components/CoverUploader";
import { ListingPicker } from "@/components/ListingPicker";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type CollectionDetail = components["schemas"]["CollectionDetail"];
type ListingCard = components["schemas"]["LocationCard"];

export default function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useAdminMe();
  const manage = can("catalog.manage");
  const key = `/v1/admin/collections/${id}`;
  const { data, error, isLoading, mutate } = useSWR(key, () =>
    adminApi.GET("/collections/{collectionId}", { params: { path: { collectionId: id } } }).then(unwrap<CollectionDetail>)
  );
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setSlug(data.slug);
      setDescription(data.description);
    }
  }, [data]);

  async function patch(body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      const next = await adminApi
        .PATCH("/collections/{collectionId}", { params: { path: { collectionId: id } }, body: body as never })
        .then(unwrap<CollectionDetail>);
      await mutate(next, { revalidate: false });
      toast.success(success);
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not save."));
    } finally {
      setBusy(false);
    }
  }

  async function reorder(next: ListingCard[]) {
    if (!data) return;
    await mutate({ ...data, listings: next }, { revalidate: false });
    try {
      const saved = await adminApi
        .PUT("/collections/{collectionId}/listings/order", { params: { path: { collectionId: id } }, body: { ordered_ids: next.map((l) => l.id) } })
        .then(unwrap<CollectionDetail>);
      await mutate(saved, { revalidate: false });
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not save the order."));
      await mutate();
    }
  }

  function move(from: number, to: number) {
    if (!data || to < 0 || to >= data.listings.length || from === to) return;
    const next = [...data.listings];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    void reorder(next);
  }

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-96 w-full" />
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <ErrorState message={extractErrorMessage(error, "Failed to load the collection.")} onRetry={() => mutate()} />
      </>
    );
  }

  const dirty = title.trim() !== data.title || slug !== data.slug || description.trim() !== data.description;
  const unpublishedInside = data.listings.filter((l) => l.status !== "published").length;

  return (
    <>
      <Link href="/collections" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Collections
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-slate-900">{data.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.listing_count} listing{data.listing_count === 1 ? "" : "s"} · public at <code className="text-xs">GET /v1/collections/{data.slug}</code>
          </p>
        </div>
        {manage && (
          <Switch
            checked={data.is_published}
            disabled={busy}
            onChange={(v) => patch({ is_published: v }, v ? "Collection published." : "Collection hidden.")}
            label={data.is_published ? "Published" : "Hidden"}
            description={data.is_published ? "Visible in the apps." : "Only admins can see it."}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card title="Cover">
            <CoverUploader
              coverUrl={data.cover_url}
              canEdit={manage}
              presign={(body) => adminApi.POST("/collections/{collectionId}/cover/upload", { params: { path: { collectionId: id } }, body }).then(unwrap)}
              complete={async (storage_key) => {
                const next = await adminApi
                  .PUT("/collections/{collectionId}/cover", { params: { path: { collectionId: id } }, body: { storage_key } })
                  .then(unwrap<CollectionDetail>);
                await mutate(next, { revalidate: false });
              }}
              remove={async () => {
                const next = await adminApi.DELETE("/collections/{collectionId}/cover", { params: { path: { collectionId: id } } }).then(unwrap<CollectionDetail>);
                await mutate(next, { revalidate: false });
              }}
            />
          </Card>
          <Card title="Details">
            <fieldset disabled={!manage} className="space-y-4">
              <TextField label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
              <TextField label="Slug" value={slug} maxLength={80} onChange={(e) => setSlug(slugify(e.target.value))} />
              <TextAreaField label="Description" rows={4} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
              {manage && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    disabled={!dirty || busy || !title.trim() || !slug}
                    onClick={() => patch({ title: title.trim(), slug, description: description.trim() }, "Collection saved.")}
                  >
                    Save
                  </Button>
                  <Button variant="danger" onClick={() => setDeleting(true)}>
                    Delete collection
                  </Button>
                </div>
              )}
            </fieldset>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Listings"
            description="Drag to set the order the apps show them in. Only published listings are shown publicly."
            actions={unpublishedInside > 0 ? <span className="text-xs text-amber-800">{unpublishedInside} not published — hidden publicly</span> : undefined}
          >
            {data.listings.length === 0 ? (
              <p className="rounded-lg border border-slate-200 px-3 py-6 text-center text-sm text-slate-500">No listings yet — add some below.</p>
            ) : (
              <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {data.listings.map((l, index) => (
                  <li
                    key={l.id}
                    draggable={manage}
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => dragIndex !== null && e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex !== null) move(dragIndex, index);
                      setDragIndex(null);
                    }}
                    onDragEnd={() => setDragIndex(null)}
                    className={cn("flex items-center gap-3 bg-white px-3 py-2 text-sm", dragIndex === index && "opacity-50")}
                  >
                    {manage && <GripVertical aria-hidden className="h-4 w-4 shrink-0 cursor-grab text-slate-300" />}
                    <span className="w-5 shrink-0 text-right text-xs text-slate-400">{index + 1}</span>
                    <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
                      {l.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.cover_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon aria-hidden className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </span>
                    <Link href={`/locations/${l.id}`} className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900 hover:underline">{l.title}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {l.city}, {l.country}
                        {l.starting_price ? ` · from ${formatMoney(l.starting_price.amount_minor_units, l.starting_price.currency)}` : ""}
                      </span>
                    </Link>
                    <StatusBadge status={l.status} />
                    {manage && (
                      <span className="flex shrink-0 items-center">
                        <button
                          type="button"
                          aria-label={`Move ${l.title} up`}
                          disabled={index === 0}
                          onClick={() => move(index, index - 1)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
                        >
                          <ArrowUp aria-hidden className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${l.title} down`}
                          disabled={index === data.listings.length - 1}
                          onClick={() => move(index, index + 1)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
                        >
                          <ArrowDown aria-hidden className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${l.title}`}
                          onClick={async () => {
                            try {
                              const next = await adminApi
                                .DELETE("/collections/{collectionId}/listings/{locationId}", { params: { path: { collectionId: id, locationId: l.id } } })
                                .then(unwrap<CollectionDetail>);
                              await mutate(next, { revalidate: false });
                            } catch (e) {
                              toast.error(extractErrorMessage(e, "Could not remove."));
                            }
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                        >
                          <X aria-hidden className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
          {manage && (
            <Card title="Add listings">
              <ListingPicker
                exclude={new Set(data.listings.map((l) => l.id))}
                busy={busy}
                onAdd={async (ids) => {
                  setBusy(true);
                  try {
                    const next = await adminApi
                      .POST("/collections/{collectionId}/listings", { params: { path: { collectionId: id } }, body: { location_ids: ids } })
                      .then(unwrap<CollectionDetail>);
                    await mutate(next, { revalidate: false });
                    toast.success(`Added ${ids.length} listing${ids.length === 1 ? "" : "s"}.`);
                  } catch (e) {
                    toast.error(extractErrorMessage(e, "Could not add listings."));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${data.title}”?`}
        description="The collection and its cover are deleted. The listings themselves are not affected."
        danger
        busy={busy}
        confirmLabel="Delete collection"
        onConfirm={async () => {
          setBusy(true);
          try {
            await adminApi.DELETE("/collections/{collectionId}", { params: { path: { collectionId: id } } }).then(unwrap);
            toast.success("Collection deleted.");
            router.push("/collections");
          } catch (e) {
            toast.error(extractErrorMessage(e, "Could not delete."));
            setBusy(false);
          }
        }}
      />
    </>
  );
}
