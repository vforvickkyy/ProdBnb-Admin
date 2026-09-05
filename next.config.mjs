/**
 * Defense-in-depth response headers (Phase 14-B5) -- this app has no XSS
 * vector found in any prior audit (no dangerouslySetInnerHTML/innerHTML,
 * React's default escaping relied on everywhere), so this is a hardening
 * addition, not a fix for a known vulnerability.
 *
 * CSP origins are derived from the same NEXT_PUBLIC_* env vars the app
 * itself already requires to function (see src/lib/supabase.ts,
 * src/lib/api.ts) -- they're already baked into the browser bundle at build
 * time, so reading them here at config time is consistent with how this
 * project already treats them, not a new requirement.
 *
 * No 'unsafe-eval': this app's production build has no dependency on it --
 * Next.js only needs eval-based sourcemaps in `next dev`'s Fast Refresh,
 * never in a production bundle. `style-src` keeps 'unsafe-inline' because
 * Radix UI (the Dialog/ConfirmDialog primitive this app is built on) can
 * apply inline `style` attributes for focus-scope/portal positioning
 * internals outside this app's own Tailwind classes; blocking that would
 * risk silently breaking every dialog in the app for a style-only,
 * low-severity trade-off. `img-src` allows any https: origin (not a fixed
 * domain) because avatar/location-media URLs are arbitrary, fully
 * backend-provided strings (R2's public base URL, wherever avatars are
 * hosted) -- this app has no fixed, safely-hardcodable media origin of its
 * own to restrict to.
 */
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildCsp() {
  const connectSrc = ["'self'", originOf(process.env.NEXT_PUBLIC_SUPABASE_URL), originOf(process.env.NEXT_PUBLIC_API_BASE_URL)].filter(
    Boolean
  );

  return [
    "default-src 'self'",
    "script-src 'self'",
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // The entire app is the Admin Console -- there's no separate
        // public/non-admin route tree to exclude.
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: buildCsp() },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
