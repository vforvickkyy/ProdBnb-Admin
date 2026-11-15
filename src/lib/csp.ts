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
 */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function buildCsp(nonce: string, env: { supabaseUrl?: string; apiBaseUrl?: string } = {}): string {
  const connectSrc = ["'self'", originOf(env.supabaseUrl), originOf(env.apiBaseUrl)].filter(Boolean);
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
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
