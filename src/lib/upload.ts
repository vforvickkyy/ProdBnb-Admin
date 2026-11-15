"use client";

/**
 * Browser uploads straight to Cloudflare R2 (Admin Console 2).
 *
 * Photos are downscaled in the browser first when they are larger than a phone screen needs
 * (longest edge > 2560px or > 2.5MB): faster uploads, faster listing pages, same look. The presigned
 * URL is signed for an exact Content-Length, so the size we ask the API for is the size of the
 * blob we actually send.
 */
const MAX_EDGE = 2560;
const MAX_BYTES_UNTOUCHED = 2.5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export async function prepareImage(file: File): Promise<Blob> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    throw new Error(`${file.name}: only JPEG, PNG or WebP images can be uploaded.`);
  }
  if (typeof createImageBitmap !== "function") {
    return file;
  }
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_EDGE && file.size <= MAX_BYTES_UNTOUCHED) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, MAX_EDGE / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = file.type === "image/png" ? "image/webp" : file.type;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  return blob && blob.size < file.size ? blob : file;
}

/** PUT with upload progress (fetch has none). Only Content-Type is set; the browser sets the length. */
export function putWithProgress(url: string, blob: Blob, contentType: string, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (HTTP ${xhr.status}).`)));
    xhr.onerror = () =>
      reject(
        new Error(
          "Upload was blocked by the network or the storage bucket's CORS rules. An admin can fix this under Integrations & Health → R2 browser uploads.",
        ),
      );
    xhr.send(blob);
  });
}
