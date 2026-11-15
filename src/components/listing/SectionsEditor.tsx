"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ChevronDown, ImageIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { listingApi, Section } from "@/lib/listingApi";
import { PhotoManager } from "./PhotoManager";

/**
 * Sections are the named parts of a location -- "Rooftop", "Kitchen", "Studio A" -- each with its
 * own description and photos, shown as rails in the apps.
 */
export function SectionsEditor({ locationId, canEdit }: { locationId: string; canEdit: boolean }) {
  const { data, error, isLoading, mutate } = useSWR(`/v1/locations/${locationId}/sections`, () => listingApi.sections(locationId));
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Section | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const section = await listingApi.createSection(locationId, { name: name.trim(), description: description.trim() || null });
      toast.success(`Section “${section.name}” added.`);
      setName("");
      setDescription("");
      setCreating(false);
      setOpen(section.id);
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the section.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(reason?: string) {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await adminApi
        .POST("/locations/{id}/sections/{sectionId}/remove", {
          params: { path: { id: locationId, sectionId: removeTarget.id } },
          body: reason ? { reason } : {},
        })
        .then(unwrap);
      toast.success("Section removed.");
      setRemoveTarget(null);
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the section.");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error) return <p className="text-sm text-red-700">Could not load sections.</p>;
  const sections = data ?? [];

  return (
    <div className="space-y-3">
      {sections.length === 0 && !creating && (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No sections. Add one for each distinct space — e.g. “Rooftop”, “Living room”, “Studio A”.
        </p>
      )}
      {sections.map((s) => (
        <SectionRow
          key={s.id}
          locationId={locationId}
          section={s}
          open={open === s.id}
          onToggle={() => setOpen(open === s.id ? null : s.id)}
          canEdit={canEdit}
          onSaved={() => mutate()}
          onRemove={() => setRemoveTarget(s)}
        />
      ))}

      {canEdit &&
        (creating ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <TextField label="Section name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rooftop" />
            <TextAreaField
              label="Description (optional)"
              rows={3}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="primary" disabled={busy || !name.trim()} onClick={create}>
                Add section
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setCreating(true)} disabled={sections.length >= 20}>
            <Plus aria-hidden className="h-4 w-4" /> New section
          </Button>
        ))}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title={`Remove section “${removeTarget?.name ?? ""}”?`}
        description={
          removeTarget && removeTarget.photo_count > 0
            ? `It still has ${removeTarget.photo_count} photo(s). Remove them first (open the section, then remove each photo) — photos are never deleted as a side effect.`
            : "The section is empty, so nothing else is affected."
        }
        optionalReason
        danger
        busy={busy}
        confirmLabel="Remove section"
        onConfirm={remove}
      />
    </div>
  );
}

function SectionRow({
  locationId,
  section,
  open,
  onToggle,
  canEdit,
  onSaved,
  onRemove,
}: {
  locationId: string;
  section: Section;
  open: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onSaved: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(section.name);
  const [description, setDescription] = useState(section.description ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== section.name || (description.trim() || null) !== section.description;

  async function save() {
    setBusy(true);
    try {
      await listingApi.updateSection(locationId, section.id, { name: name.trim(), description: description.trim() || null });
      toast.success("Section saved.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
          {section.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={section.cover.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon aria-hidden className="h-4 w-4 text-slate-400" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-900">{section.name}</span>
          <span className="block text-xs text-slate-500">
            {section.photo_count} photo{section.photo_count === 1 ? "" : "s"}
            {section.description ? ` · ${section.description.slice(0, 80)}` : ""}
          </span>
        </span>
        <ChevronDown aria-hidden className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-fade-in space-y-4 border-t border-slate-200 p-4">
          {canEdit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
              <TextAreaField
                className="sm:col-span-2"
                label="Description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex gap-2 sm:col-span-2">
                <Button variant="primary" size="sm" disabled={busy || !dirty || !name.trim()} onClick={save}>
                  Save section
                </Button>
                <Button variant="danger" size="sm" onClick={onRemove}>
                  Remove section
                </Button>
              </div>
            </div>
          )}
          <PhotoManager locationId={locationId} sectionId={section.id} canEdit={canEdit} onChanged={onSaved} />
        </div>
      )}
    </div>
  );
}
