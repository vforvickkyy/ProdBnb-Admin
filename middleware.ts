import { NextRequest, NextResponse } from "next/server";
import { SESSION_HINT_COOKIE } from "@/lib/sessionHint";

// Basic session-presence check only (Phase 14 decision -- see
// src/lib/sessionHint.ts for why this can't be a real server-side auth
// check without adopting @supabase/ssr). Redirects a browser with no hint
// cookie straight to /login before any page shell/JS ships, closing the gap
// where the old client-only gate briefly rendered the app shell first. The
// actual admin-role check remains client-side via useAdminGate + server-side
// via requireRole('admin') on every backend call -- unchanged by this file.
const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const hasHint = request.cookies.has(SESSION_HINT_COOKIE);
  if (!hasHint) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
