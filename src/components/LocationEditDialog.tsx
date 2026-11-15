"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { extractErrorMessage } from "@/components/ui/ErrorState";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { adminApi, unwrap } from "@/lib/api";
import type { components, paths } from "@/types/admin-api";

type LocationDetail = components["schemas"]["LocationDetail"];
type Patch = NonNullable<paths["/locations/{id}"]["patch"]["requestBody"]>["content"]["application/json"];

/**
 * Correct a listing's content on the host's behalf. Status never moves here (only through the
 * audited moderation actions); every save is audited with the field names changed.
 */
export function LocationEditDialog({
  location,
  open,
  onOpenChange,
  onSaved,
}: {
  location: LocationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(location.title);
  const [description, setDescription] = useState(location.description);
  const [city, setCity] = useState(location.city);
  const [region, setRegion] = useState(location.region ?? "");
  const [country, setCountry] = useState(location.country);
  const [capacity, setCapacity] = useState(location.capacity?.toString() ?? "");
  const [instant, setInstant] = useState(location.instant_booking_enabled);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(location.title);
    setDescription(location.description);
    setCity(location.city);
    setRegion(location.region ?? "");
    setCountry(location.country);
    setCapacity(location.capacity?.toString() ?? "");
    setInstant(location.instant_booking_enabled);
    setReason("");
  }, [open, location]);

  const patch: Patch = {};
  if (title.trim() !== location.title) patch.title = title.trim();
  if (description !== location.description) patch.description = description;
  if (city.trim() !== location.city) patch.city = city.trim();
  if ((region.trim() || null) !== (location.region ?? null)) patch.region = region.trim() || null;
  if (country.trim() !== location.country) patch.country = country.trim();
  const capacityValue = capacity.trim() === "" ? null : Number(capacity);
  if (capacityValue !== (location.capacity ?? null)) patch.capacity = capacityValue;
  if (instant !== location.instant_booking_enabled) patch.instant_booking_enabled = instant;
  const changed = Object.keys(patch).length > 0;
  const invalid =
    title.trim().length === 0 || city.trim().length === 0 || country.trim().length === 0 ||
    (capacityValue !== null && (!Number.isInteger(capacityValue) || capacityValue <= 0));

  async function save() {
    setBusy(true);
    try {
      await adminApi
        .PATCH("/locations/{id}", { params: { path: { id: location.id } }, body: { ...patch, ...(reason.trim() ? { reason: reason.trim() } : {}) } })
        .then(unwrap);
      toast.success("Listing updated.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to update the listing."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Edit listing" description="Corrections are visible to bookers immediately and recorded in the audit log.">
      <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <TextAreaField label="Description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
          <TextField label="Region / state" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={120} />
          <TextField label="Country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={120} />
          <TextField label="Capacity (people)" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} className="h-4 w-4" />
          Instant booking (no host approval needed)
        </label>
        <TextField label="Reason (optional, for the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={!changed || invalid || busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </Dialog>
  );
}
