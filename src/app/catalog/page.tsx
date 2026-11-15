"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, extractErrorMessage } from "@/components/ui/ErrorState";
import { TextField } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, type Column } from "@/components/ui/Table";
import { adminApi, unwrap } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useAdminMe } from "@/lib/useAdminMe";
import type { components } from "@/types/admin-api";

type Item = components["schemas"]["AdminCatalogItem"];
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
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);

  function openEditor(item: Item | "new") {
    setEditing(item);
    setName(item === "new" ? "" : item.name);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      if (editing === "new") {
        await adminApi.POST("/catalog/{kind}", { params: { path: { kind } }, body: { name: name.trim() } }).then(unwrap);
        toast.success(`Added "${name.trim()}".`);
      } else {
        await adminApi
          .PATCH("/catalog/{kind}/{itemId}", { params: { path: { kind, itemId: editing.id } }, body: { name: name.trim() } })
          .then(unwrap);
        toast.success(`Renamed to "${name.trim()}".`);
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
      toast.success(`Deleted "${deleting.name}".`);
      setDeleting(null);
      await mutate();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to delete."));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Item>[] = [
    { key: "name", header: "Name", render: (i) => <span className="font-medium text-slate-800">{i.name}</span> },
    { key: "usage", header: "Used by", render: (i) => `${i.usage_count} listing${i.usage_count === 1 ? "" : "s"}` },
    { key: "created", header: "Added", render: (i) => formatDate(i.created_at) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (i) =>
        manage ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => openEditor(i)}>
              Rename
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setDeleting(i)}
              disabled={i.usage_count > 0}
              title={i.usage_count > 0 ? "In use — rename it, or remove it from those listings first" : undefined}
            >
              Delete
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <AdminShell>
      <PageHeader
        title="Catalog"
        description="The options hosts tag their listings with, and bookers filter by."
        actions={
          manage && (
            <Button variant="primary" onClick={() => openEditor("new")}>
              Add {meta.singular}
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Segmented label="Catalog type" value={kind} options={KINDS} onChange={setKind} />
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : error || !items ? (
        <ErrorState message={extractErrorMessage(error, "Failed to load the catalog.")} onRetry={() => mutate()} />
      ) : items.length === 0 ? (
        <EmptyState title={`No ${meta.label.toLowerCase()} yet.`} />
      ) : (
        <Table caption={meta.label} columns={columns} rows={items} rowKey={(i) => i.id} />
      )}
      <p className="mt-3 text-xs text-slate-500">
        An option still used by a listing can be renamed but not deleted — deleting it would silently remove it from every listing.
      </p>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} title={editing === "new" ? `Add ${meta.singular}` : `Rename ${meta.singular}`}>
        <div className="space-y-4">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
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
        title={`Delete "${deleting?.name ?? ""}"?`}
        description="It is not used by any listing. This cannot be undone."
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={remove}
      />
    </AdminShell>
  );
}
