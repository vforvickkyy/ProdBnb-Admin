/**
 * Content-Security-Policy for the Admin Console, built per request.
 *
 * Next.js's App Router streams its page data through small INLINE scripts
 * (`self.__next_f.push(...)`). The Phase 14-B5 header was a static `script-src 'self'` from
 * next.config.mjs, which blocks every one of them: the browser never hydrates, so the console was
 * unusable (the login form rendered as dead HTML). The fix is Next's documented nonce pattern -- a
 * fresh random nonce per request, sent both to the browser (response header) and to Next (request
 * header, which it reads to stamp the same nonce on its own scripts) -- so Next's scripts run and
 * nothing else inline can. `'strict-dynamic'` lets those nonce'd scripts load the app's chunks.
 *
 * Everything else is unchanged from Phase 14-B5: no 'unsafe-eval'; styles keep 'unsafe-inline'
 * (Radix sets inline style attributes); images from any https origin (avatars/media are arbitrary
 * backend-provided URLs); connections only to this app, Supabase and the backend.
 *
 * Admin Console 2: photo/cover uploads PUT straight to a presigned Cloudflare R2 URL, so R2's S3
 * endpoint (`<account>.r2.cloudflarestorage.com`) is allowed for connections, and `blob:` images for
 * the local preview shown while a file uploads.
 */
export const R2_UPLOAD_ORIGIN = "https://*.r2.cloudflarestorage.com";

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function buildCsp(nonce: string, env: { supabaseUrl?: string; apiBaseUrl?: string; dev?: boolean } = {}): string {
  const connectSrc = ["'self'", originOf(env.supabaseUrl), originOf(env.apiBaseUrl), R2_UPLOAD_ORIGIN].filter(Boolean);
  return [
    "default-src 'self'",
    // `next dev` (never a production build) needs eval for React Refresh -- Next's documented pattern.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${env.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function newNonce(): string {
  return btoa(crypto.randomUUID());
}
