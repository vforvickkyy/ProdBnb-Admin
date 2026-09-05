// Supabase's client here persists sessions to localStorage (no @supabase/ssr,
// no cookie-based session) -- Next.js middleware runs at the edge and can
// only see the request's cookies/headers, never a browser's localStorage.
// This lightweight, non-sensitive marker cookie is the only thing that lets
// middleware make even a basic "was this browser logged in" guess before
// rendering. It is NOT a security boundary -- it can't be, since it's just
// a flag a client could set without a real session. The actual boundary is
// unchanged: every /v1/admin/* call still requires a real, valid bearer
// token and requireRole('admin') server-side, regardless of this cookie.
// Its only job is closing the "public shell renders before the real client-
// side gate resolves" gap as cheaply as possible (Phase 14 decision: basic
// presence check, not full server-side auth via @supabase/ssr).
const COOKIE_NAME = "pb-admin-hint";

export function setSessionHint(): void {
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function clearSessionHint(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}

export const SESSION_HINT_COOKIE = COOKIE_NAME;
