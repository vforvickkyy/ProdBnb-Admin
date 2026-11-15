"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ACCEPTED_IMAGE_TYPES, prepareImage, putWithProgress } from "@/lib/upload";

export interface CoverPresign {
  upload_url: string;
  storage_key: string;
  headers: Record<string, string>;
}

/**
 * One cover image: presign -> PUT straight to R2 (with progress) -> confirm. Used by catalog items
 * and collections; the caller supplies the two API calls.
 */
export function CoverUploader({
  coverUrl,
  canEdit,
  presign,
  complete,
  remove,
  aspect = "aspect-[16/9]",
}: {
  coverUrl: string | null;
  canEdit: boolean;
  presign: (input: { content_type: "image/jpeg" | "image/png" | "image/webp"; size_bytes: number }) => Promise<CoverPresign>;
  complete: (storageKey: string) => Promise<unknown>;
  remove: () => Promise<unknown>;
  aspect?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function upload(file: File) {
    const local = URL.createObjectURL(file);
    setPreview(local);
    setProgress(0);
    try {
      const blob = await prepareImage(file);
      const type = (blob.type || file.type) as "image/jpeg" | "image/png" | "image/webp";
      const auth = await presign({ content_type: type, size_bytes: blob.size });
      await putWithProgress(auth.upload_url, blob, type, setProgress);
      await complete(auth.storage_key);
      toast.success("Cover updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setProgress(null);
      setPreview(null);
      URL.revokeObjectURL(local);
    }
  }

  const shown = preview ?? coverUrl;
  return (
    <div>
      <div className={`relative ${aspect} w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100`}>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
            <ImageIcon aria-hidden className="h-6 w-6" />
            <span className="text-xs">No cover yet</span>
          </div>
        )}
        {progress !== null && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-200" aria-live="polite" aria-label={`Uploading ${Math.round(progress * 100)}%`}>
            <div className="h-full bg-accent-500 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>
      {canEdit && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" disabled={progress !== null} onClick={() => inputRef.current?.click()}>
            <ImagePlus aria-hidden className="h-3.5 w-3.5" /> {coverUrl ? "Replace" : "Upload"} cover
          </Button>
          {coverUrl && (
            <Button
              size="sm"
              variant="ghost"
              disabled={progress !== null}
              onClick={async () => {
                try {
                  await remove();
                  toast.success("Cover removed.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not remove the cover.");
                }
              }}
            >
              <Trash2 aria-hidden className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="sr-only"
            aria-label="Choose cover image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
