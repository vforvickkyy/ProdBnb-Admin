/**
 * Static defence-in-depth headers (Phase 14-B5). The Content-Security-Policy is NOT set here any
 * more: it needs a fresh nonce per request, so src/middleware.ts builds it (src/lib/csp.ts). A
 * static `script-src 'self'` here blocked Next.js's own inline scripts and left the console unable
 * to hydrate.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Console 3: re-opening a page visited in the last 30s reuses its (data-free) page shell from the
    // client router cache instead of waiting on the server again. Every page fetches its own data
    // client-side through SWR, so nothing stale is shown -- the page still revalidates on mount.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      {
        // The entire app is the Admin Console -- there's no separate
        // public/non-admin route tree to exclude.
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
