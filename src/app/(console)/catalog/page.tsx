"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import useSWR from "swr";
import { ImageIcon, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { CoverUploader } from "@/components/CoverUploader";
import { ListingPicker } from "@/components/ListingPicker";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap, unwrapPaginated } from "@/lib/api";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Item = components["schemas"]["AdminCatalogItem"];
type Card = components["schemas"]["LocationCard"];
type Kind = "categories" | "amenities" | "use-cases";

const KINDS: { value: Kind; label: string; singular: string }[] = [
  { value: "categories", label: "Categories", singular: "category" },
  { value: "amenities", label: "Amenities", singular: "amenity" },
  { value: "use-cases", label: "Use cases", singular: "use case" },
];

export default function CatalogPage() {
  const { can } = useAdminMe();
  const manage = can("catalog.manage");
  const [kind, setKind] = useState<Kind>("categories");
  const meta = KINDS.find((k) => k.value === kind)!;
  const { data: items, error, isLoading, mutate } = useSWR(`/v1/admin/catalog/${kind}`, () =>
    adminApi.GET("/catalog/{kind}", { params: { path: { kind } } }).then(unwrap<Item[]>)
  );

  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // Amenities only: a tick-box feature or a house rule, which heading it sits under, and its order.
  const [amenityKind, setAmenityKind] = useState<"amenity" | "rule">("amenity");
  const [groupName, setGroupName] = useState("");
  const [position, setPosition] = useState("");
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [openItem, setOpenItem] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);

  function openEditor(item: Item | "new") {
    setEditing(item);
    setName(item === "new" ? "" : item.name);
    setDescription(item === "new" ? "" : (item.description ?? ""));
    setAmenityKind(item === "new" ? "amenity" : (item.kind ?? "amenity"));
    setGroupName(item === "new" ? "" : (item.group_name ?? ""));
    setPosition(item === "new" ? "" : item.position === undefined ? "" : String(item.position));
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const positionNumber = position.trim() === "" ? undefined : Number(position);
      if (kind === "amenities" && positionNumber !== undefined && (!Number.isInteger(positionNumber) || positionNumber < 0 || positionNumber > 10000)) {
        toast.error("Order must be a whole number from 0 to 10000.");
        setBusy(false);
        return;
      }
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        ...(kind === "amenities"
          ? { kind: amenityKind, group_name: groupName.trim() || null, ...(positionNumber !== undefined ? { position: positionNumber } : {}) }
          : {}),
      };
      if (editing === "new") {
        await adminApi.POST("/catalog/{kind}", { params: { path: { kind } }, body }).then(unwrap);
        toast.success(`Added “${body.name}”.`);
      } else {
        await adminApi.PATCH("/catalog/{kind}/{itemId}", { params: { path: { kind, itemId: editing.id } }, body }).then(unwrap);
        toast.success(`Saved “${body.name}”.`);
      }
      setEditing(null);
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to save."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminApi.DELETE("/catalog/{kind}/{itemId}", { params: { path: { kind, itemId: deleting.id } } }).then(unwrap);
      toast.success(`Deleted “${deleting.name}”.`);
      setDeleting(null);
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to delete."));
    } finally {
      setBusy(false);
    }
  }

  // Keep the open sheet in sync with fresh data (cover/usage changes).
  const liveOpen = openItem ? (items?.find((i) => i.id === openItem.id) ?? openItem) : null;

  return (
    <>
      <PageHeader
        title="Catalog"
        description="The categories, amenities and use cases listings are tagged with — with cover images for the apps' browse tiles."
        actions={
          <>
            <Link
              href="/collections"
              className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 shadow-card transition-colors hover:bg-slate-50"
            >
              <Layers aria-hidden className="h-4 w-4" /> Collections
            </Link>
            {manage && (
              <Button variant="primary" onClick={() => openEditor("new")}>
                <Plus aria-hidden className="h-4 w-4" /> Add {meta.singular}
              </Button>
            )}
          </>
        }
      />
      <div className="mb-5">
        <Segmented label="Catalog type" value={kind} options={KINDS} onChange={setKind} />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : error || !items ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load the catalog.")} onRetry={() => mutate()} />
      ) : items.length === 0 ? (
        <EmptyState title={`No ${meta.label.toLowerCase()} yet.`} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <button type="button" onClick={() => setOpenItem(item)} className="text-left">
                <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-slate-100">
                  {item.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                  ) : (
                    <ImageIcon aria-hidden className="h-6 w-6 text-slate-300" />
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium text-slate-900">{item.name}</p>
                  {kind === "amenities" && (
                    <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {item.kind === "rule" ? "Location rule" : "Amenity"}
                      {item.group_name ? ` · ${item.group_name}` : ""}
                    </p>
                  )}
                  <p className="mt-0.5 line-clamp-2 min-h-[2.5em] text-xs text-slate-500">{item.description || "No description"}</p>
                </div>
              </button>
              <div className="mt-auto flex items-center justify-between border-t border-slate-100 px-3 py-2">
                <button type="button" onClick={() => setOpenItem(item)} className="text-xs font-medium text-slate-600 underline hover:text-slate-900">
                  {item.usage_count} listing{item.usage_count === 1 ? "" : "s"}
                </button>
                {manage && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => openEditor(item)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Pencil aria-hidden className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => setDeleting(item)}
                      disabled={item.usage_count > 0}
                      title={item.usage_count > 0 ? "In use — remove it from those listings first" : undefined}
                      className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-slate-500">
        An option still used by a listing can be edited but not deleted — deleting it would silently remove it from every listing.
      </p>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? `Add ${meta.singular}` : `Edit ${meta.singular}`}
      >
        <div className="space-y-4">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
          <TextAreaField
            label="Description (optional)"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            hint="Shown under the tile in the apps."
          />
          {kind === "amenities" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Shown under" value={amenityKind} onChange={(e) => setAmenityKind(e.target.value as "amenity" | "rule")}>
                <option value="amenity">Amenities</option>
                <option value="rule">Location rules (“Allowed here”)</option>
              </SelectField>
              <TextField
                label="Order"
                type="number"
                min={0}
                max={10000}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                hint="Lower numbers come first."
              />
              <TextField
                className="sm:col-span-2"
                label="Group heading"
                list="catalog-groups"
                value={groupName}
                maxLength={60}
                onChange={(e) => setGroupName(e.target.value)}
                hint="Options with the same heading are shown together, e.g. “Power and internet”."
              />
              <datalist id="catalog-groups">
                {[...new Set((items ?? []).map((i) => i.group_name).filter((g): g is string => Boolean(g)))].map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy || name.trim().length === 0}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="It is not used by any listing. This cannot be undone."
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={remove}
      />

      {liveOpen && (
        <ItemSheet kind={kind} singular={meta.singular} item={liveOpen} manage={manage} onClose={() => setOpenItem(null)} onChanged={() => mutate()} />
      )}
    </>
  );
}

function ItemSheet({
  kind,
  singular,
  item,
  manage,
  onClose,
  onChanged,
}: {
  kind: Kind;
  singular: string;
  item: Item;
  manage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const listingsKey = `/v1/admin/catalog/${kind}/${item.id}/listings?page=${page}`;
  const listings = useSWR(listingsKey, () =>
    adminApi
      .GET("/catalog/{kind}/{itemId}/listings", { params: { path: { kind, itemId: item.id }, query: { page, pageSize: 10 } } })
      .then(unwrapPaginated<Card>)
  );

  async function add(ids: string[]) {
    setBusy(true);
    try {
      const { added } = await adminApi
        .POST("/catalog/{kind}/{itemId}/listings", { params: { path: { kind, itemId: item.id } }, body: { location_ids: ids } })
        .then(unwrap<{ added: number }>);
      toast.success(`Added ${added} listing${added === 1 ? "" : "s"} to “${item.name}”.`);
      await listings.mutate();
      onChanged();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not add listings."));
    } finally {
      setBusy(false);
    }
  }

  async function removeListing(card: Card) {
    try {
      await adminApi
        .DELETE("/catalog/{kind}/{itemId}/listings/{locationId}", { params: { path: { kind, itemId: item.id, locationId: card.id } } })
        .then(unwrap);
      toast.success(`Removed “${card.title}”.`);
      await listings.mutate();
      onChanged();
    } catch (e) {
      toast.error(extractErrorMessage(e, "Could not remove the listing."));
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={item.name} description={`${singular[0]!.toUpperCase()}${singular.slice(1)} · ${item.usage_count} listings`}>
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Cover image</h3>
          <CoverUploader
            coverUrl={item.cover_url}
            canEdit={manage}
            presign={(body) =>
              adminApi.POST("/catalog/{kind}/{itemId}/cover/upload", { params: { path: { kind, itemId: item.id } }, body }).then(unwrap)
            }
            complete={async (storage_key) => {
              await adminApi.PUT("/catalog/{kind}/{itemId}/cover", { params: { path: { kind, itemId: item.id } }, body: { storage_key } }).then(unwrap);
              onChanged();
            }}
            remove={async () => {
              await adminApi.DELETE("/catalog/{kind}/{itemId}/cover", { params: { path: { kind, itemId: item.id } } }).then(unwrap);
              onChanged();
            }}
          />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Listings with this {singular}</h3>
          {listings.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : listings.error ? (
            <p className="text-sm text-red-700">Could not load listings.</p>
          ) : (listings.data?.data ?? []).length === 0 ? (
            <p className="rounded-lg border border-slate-200 px-3 py-4 text-center text-sm text-slate-500">No listings yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {listings.data!.data.map((card) => (
                <li key={card.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
                    {card.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon aria-hidden className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </span>
                  <Link href={`/locations/${card.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900 hover:underline">{card.title}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {card.city}, {card.country}
                    </span>
                  </Link>
                  <StatusBadge status={card.status} />
                  {manage && (
                    <button
                      type="button"
                      aria-label={`Remove ${card.title} from ${item.name}`}
                      onClick={() => removeListing(card)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <X aria-hidden className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {listings.data?.meta && listings.data.meta.total > listings.data.meta.pageSize && (
            <Pagination page={page} pageSize={listings.data.meta.pageSize} total={listings.data.meta.total} onPageChange={setPage} label="Listings" />
          )}
        </section>

        {manage && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Add listings</h3>
            <ListingPicker exclude={new Set((listings.data?.data ?? []).map((c) => c.id))} onAdd={add} busy={busy} />
          </section>
        )}
      </div>
    </Sheet>
  );
}
