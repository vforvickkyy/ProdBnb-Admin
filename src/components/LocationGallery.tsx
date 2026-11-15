"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { extractErrorMessage } from "@/components/ui/ErrorState";
import { adminApi, unwrap } from "@/lib/api";
import type { components } from "@/types/admin-api";

type Media = components["schemas"]["PublicMediaItem"];
type Gallery = components["schemas"]["LocationGallery"];

type Pending = { kind: "media"; media: Media } | { kind: "section"; id: string; name: string };

function MediaGrid({ media, canModerate, onRemove }: { media: Media[]; canModerate: boolean; onRemove: (m: Media) => void }) {
  if (media.length === 0) return <p className="text-sm text-slate-400">No photos.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {media.map((m) => (
        <figure key={m.id} className="group relative">
          {m.media_type === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.url} alt="" className="h-32 w-full rounded object-cover" />
          ) : (
            <video src={m.url} controls className="h-32 w-full rounded object-cover" />
          )}
          {canModerate && (
            <button
              type="button"
              onClick={() => onRemove(m)}
              className="absolute right-1.5 top-1.5 rounded bg-white/95 px-2 py-0.5 text-xs font-medium text-red-700 shadow ring-1 ring-red-200 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label={`Remove ${m.media_type} ${m.position + 1}`}
            >
              Remove
            </button>
          )}
        </figure>
      ))}
    </div>
  );
}

/**
 * The listing's whole gallery: the general photos plus each production-area section's. Falls back
 * to the general media embedded in the location detail until (or if) the gallery call answers, so
 * the page never shows less than it did before the gallery endpoint existed.
 */
export function LocationGallery({
  locationId,
  fallbackMedia,
  canModerate,
  onChanged,
}: {
  locationId: string;
  fallbackMedia: Media[];
  canModerate: boolean;
  onChanged?: () => void;
}) {
  const { data: gallery, mutate } = useSWR(`/v1/admin/locations/${locationId}/gallery`, () =>
    adminApi.GET("/locations/{id}/gallery", { params: { path: { id: locationId } } }).then(unwrap<Gallery>)
  );
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmRemoval(reason?: string) {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "media") {
        await adminApi
          .POST("/locations/{id}/media/{mediaId}/remove", { params: { path: { id: locationId, mediaId: pending.media.id } }, body: { reason } })
          .then(unwrap);
        toast.success("Photo removed from the listing.");
      } else {
        await adminApi
          .POST("/locations/{id}/sections/{sectionId}/remove", { params: { path: { id: locationId, sectionId: pending.id } }, body: { reason } })
          .then(unwrap);
        toast.success(`Section "${pending.name}" removed.`);
      }
      setPending(null);
      await mutate();
      onChanged?.();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Removal failed."));
    } finally {
      setBusy(false);
    }
  }

  // Tolerate an absent or differently-shaped response (e.g. a backend deployed before the gallery
  // endpoint existed): the page then shows exactly what it showed before.
  const general = Array.isArray(gallery?.general) ? gallery.general : fallbackMedia;
  const sections = Array.isArray(gallery?.sections) ? gallery.sections : [];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">General gallery</h3>
        <MediaGrid media={general} canModerate={canModerate} onRemove={(m) => setPending({ kind: "media", media: m })} />
      </div>
      {sections.map(({ section, media }) => (
        <div key={section.id}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {section.name} <span className="font-normal normal-case text-slate-400">· {media.length} photo{media.length === 1 ? "" : "s"}</span>
            </h3>
            {canModerate && media.length === 0 && (
              <Button size="sm" variant="danger" onClick={() => setPending({ kind: "section", id: section.id, name: section.name })}>
                Remove section
              </Button>
            )}
          </div>
          {section.description && <p className="mb-2 text-sm text-slate-500">{section.description}</p>}
          <MediaGrid media={media} canModerate={canModerate} onRemove={(m) => setPending({ kind: "media", media: m })} />
        </div>
      ))}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === "section" ? `Remove the "${pending.name}" section?` : "Remove this photo?"}
        description={
          pending?.kind === "section"
            ? "The section is empty. The host can recreate it. Recorded in the audit log."
            : "The photo is deleted from storage and disappears from the listing for everyone. The host is not notified automatically. Recorded in the audit log."
        }
        confirmLabel="Remove"
        danger
        optionalReason
        busy={busy}
        onConfirm={confirmRemoval}
      />
    </div>
  );
}
