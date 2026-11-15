import { NextRequest, NextResponse } from "next/server";
import { buildCsp, newNonce } from "@/lib/csp";
import { SESSION_HINT_COOKIE } from "@/lib/sessionHint";

// Two jobs, both per request:
//
// 1. Content-Security-Policy with a fresh nonce (see src/lib/csp.ts for why it must be per-request
//    rather than a static next.config header). Applied to every page, including /login.
//
// 2. Basic session-presence check only (Phase 14 decision -- see src/lib/sessionHint.ts for why
//    this can't be a real server-side auth check without adopting @supabase/ssr). Redirects a
//    browser with no hint cookie straight to /login before any page shell/JS ships. The actual
//    admin-role check remains client-side via useAdminGate + server-side via requireRole('admin')
//    and per-route permissions on every backend call -- unchanged by this file.
const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith("/_next") || pathname.startsWith("/api");
  if (!isPublic && !request.cookies.has(SESSION_HINT_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const nonce = newNonce();
  const csp = buildCsp(nonce, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
    dev: process.env.NODE_ENV === "development",
  });

  // Next reads the nonce from the *request's* CSP header and stamps it on its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Static assets and image optimisation never need a nonce; prefetches skip middleware work too.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
