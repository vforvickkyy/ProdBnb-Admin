"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Loader2, Star, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, unwrap } from "@/lib/api";
import { cn } from "@/lib/cn";
import { listingApi, MediaItem } from "@/lib/listingApi";
import { ACCEPTED_IMAGE_TYPES, prepareImage, putWithProgress } from "@/lib/upload";

const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

interface PendingUpload {
  key: string;
  name: string;
  preview: string | null;
  progress: number;
  error: string | null;
}

/**
 * A listing's photo gallery (or one section's): drag to reorder, the first photo is the cover,
 * upload many at once straight to R2 with progress, remove with an audited reason. Every move has a
 * keyboard equivalent (Move earlier / later / Make cover).
 */
export function PhotoManager({
  locationId,
  sectionId = null,
  canEdit,
  onChanged,
}: {
  locationId: string;
  sectionId?: string | null;
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const key = sectionId ? `/v1/locations/${locationId}/sections/${sectionId}/media` : `/v1/locations/${locationId}/media`;
  const { data, error, isLoading, mutate } = useSWR(key, () =>
    sectionId ? listingApi.sectionMedia(locationId, sectionId) : listingApi.media(locationId),
  );
  const media = useMemo(() => data ?? [], [data]);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MediaItem | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveOrder = useCallback(
    async (next: MediaItem[]) => {
      const previous = media;
      await mutate(
        next.map((m, i) => ({ ...m, position: i })),
        { revalidate: false },
      );
      try {
        await listingApi.reorder(
          locationId,
          next.map((m) => m.id),
          sectionId,
        );
        await mutate();
        onChanged?.();
      } catch (e) {
        await mutate(previous, { revalidate: false });
        toast.error(e instanceof Error ? e.message : "Could not save the new order.");
      }
    },
    [media, mutate, locationId, sectionId, onChanged],
  );

  function move(from: number, to: number) {
    if (to < 0 || to >= media.length || from === to) return;
    const next = [...media];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    void saveOrder(next);
  }

  async function uploadOne(file: File) {
    const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
    const isVideo = VIDEO_TYPES.includes(file.type);
    const preview = isVideo ? null : URL.createObjectURL(file);
    setUploads((u) => [...u, { key, name: file.name, preview, progress: 0, error: null }]);
    const update = (patch: Partial<PendingUpload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    try {
      if (!isVideo && !ACCEPTED_IMAGE_TYPES.includes(file.type as never)) {
        throw new Error("Only JPEG, PNG, WebP photos or MP4/MOV/WebM videos.");
      }
      const blob = isVideo ? file : await prepareImage(file);
      const contentType = blob.type || file.type;
      const auth = await listingApi.requestUpload(locationId, {
        media_type: isVideo ? "video" : "photo",
        content_type: contentType,
        size_bytes: blob.size,
      });
      await putWithProgress(auth.upload_url, blob, contentType, (p) => update({ progress: p }));
      await listingApi.completeUpload(locationId, auth.media_id, sectionId);
      setUploads((u) => u.filter((x) => x.key !== key));
      if (preview) URL.revokeObjectURL(preview);
      await mutate();
      onChanged?.();
    } catch (e) {
      update({ error: e instanceof Error ? e.message : "Upload failed." });
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    // Two at a time: fast, without saturating a hotel Wi-Fi uplink.
    const queue = [...list];
    await Promise.all(
      [0, 1].map(async () => {
        while (queue.length) {
          await uploadOne(queue.shift()!);
        }
      }),
    );
  }

  async function confirmRemove(reason?: string) {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await adminApi
        .POST("/locations/{id}/media/{mediaId}/remove", {
          params: { path: { id: locationId, mediaId: removeTarget.id } },
          body: reason ? { reason } : {},
        })
        .then(unwrap);
      toast.success("Photo removed.");
      setRemoveTarget(null);
      await mutate();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the photo.");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-red-700">Could not load photos: {error instanceof Error ? error.message : "unknown error"}</p>;
  }

  return (
    <div>
      {canEdit && (
        <div
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setDropActive(true);
            }
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => {
            if (e.dataTransfer.files.length) {
              e.preventDefault();
              setDropActive(false);
              void uploadFiles(e.dataTransfer.files);
            }
          }}
          className={cn(
            "mb-4 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
            dropActive ? "border-accent-500 bg-accent-50" : "border-slate-300 bg-slate-50",
          )}
        >
          <UploadCloud aria-hidden className="h-6 w-6 text-slate-400" />
          <p className="text-sm text-slate-600">Drop photos here, or</p>
          <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()}>
            <ImagePlus aria-hidden className="h-3.5 w-3.5" /> Choose files
          </Button>
          <p className="text-xs text-slate-500">JPEG, PNG or WebP (large photos are resized to 2560px) · MP4/MOV/WebM video</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={[...ACCEPTED_IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
            className="sr-only"
            aria-label="Upload photos"
            onChange={(e) => {
              if (e.target.files) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {media.length === 0 && uploads.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No photos yet.{canEdit ? " The first photo you add becomes the cover." : ""}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={sectionId ? "Section photos" : "Listing photos"}>
          {media.map((item, index) => (
            <li
              key={item.id}
              draggable={canEdit}
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", item.id);
              }}
              onDragOver={(e) => {
                if (dragIndex !== null) {
                  e.preventDefault();
                  setOverIndex(index);
                }
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDrop={(e) => {
                if (dragIndex !== null) {
                  e.preventDefault();
                  move(dragIndex, index);
                }
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-white shadow-sm transition-all",
                overIndex === index && dragIndex !== index ? "border-accent-500 ring-2 ring-accent-500" : "border-slate-200",
                dragIndex === index && "opacity-50",
              )}
            >
              <div className="relative aspect-[4/3] bg-slate-100">
                {item.media_type === "video" ? (
                  <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={`Photo ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />
                )}
                {index === 0 && !sectionId && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-snow">
                    <Star aria-hidden className="h-3 w-3 fill-current" /> Cover
                  </span>
                )}
                {canEdit && (
                  <span
                    aria-hidden
                    className="absolute right-2 top-2 cursor-grab rounded bg-black/50 p-1 text-snow opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              {canEdit && (
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <div className="flex items-center gap-0.5">
                    <IconButton label={`Move photo ${index + 1} earlier`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton label={`Move photo ${index + 1} later`} disabled={index === media.length - 1} onClick={() => move(index, index + 1)}>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {index !== 0 && !sectionId && (
                      <button
                        type="button"
                        onClick={() => move(index, 0)}
                        className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      >
                        Make cover
                      </button>
                    )}
                    <IconButton label={`Remove photo ${index + 1}`} onClick={() => setRemoveTarget(item)} danger>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                </div>
              )}
            </li>
          ))}
          {uploads.map((u) => (
            <li key={u.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="relative aspect-[4/3] bg-slate-100">
                {u.preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.preview} alt="" className="h-full w-full object-cover opacity-60" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  {u.error ? null : <Loader2 aria-hidden className="h-6 w-6 animate-spin text-slate-600" />}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-200">
                  <div className="h-full bg-accent-500 transition-[width]" style={{ width: `${Math.round(u.progress * 100)}%` }} />
                </div>
              </div>
              <div className="px-2 py-1.5 text-xs">
                <p className="truncate text-slate-700">{u.name}</p>
                {u.error ? (
                  <p role="alert" className="mt-0.5 text-red-700">
                    {u.error}{" "}
                    <button type="button" className="underline" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}>
                      Dismiss
                    </button>
                  </p>
                ) : (
                  <p className="text-slate-500" aria-live="polite">
                    Uploading… {Math.round(u.progress * 100)}%
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove this photo?"
        description="It disappears from the listing everywhere. The host can see the reason in the audit trail."
        optionalReason
        danger
        busy={busy}
        confirmLabel="Remove photo"
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded p-1 text-slate-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-30",
        danger ? "hover:bg-red-50 hover:text-red-700" : "hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}
