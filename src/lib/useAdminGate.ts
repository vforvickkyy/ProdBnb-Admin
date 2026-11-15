"use client";

import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { getMe } from "./api";
import { supabase } from "./supabase";

export type GateStatus = "checking" | "signed-out" | "not-admin" | "admin" | "unreachable";

const ME_KEY = "/v1/me";

/**
 * UI gating only -- "am I an admin" here decides whether to render admin
 * screens or bounce to /login, never an authorization decision. The real
 * boundary is server-side: every /v1/admin/* call still requires
 * requireRole('admin') on the backend regardless of what this hook renders
 * (docs/ARCHITECTURE.md in the backend repo).
 *
 * Backed by SWR (Phase 14) rather than a bare fetch-on-mount: every page is
 * wrapped in AdminShell, so without a shared cache this hook re-ran a fresh
 * /v1/me round trip on every single navigation. SWR dedupes that across the
 * whole app for its default window, and `mutate` below forces a real
 * re-check exactly when auth state actually changes (sign-in/sign-out),
 * not on a timer.
 *
 * Console 3: only a real auth rejection (401/403) means "signed out". A network failure, a rate
 * limit or a server error used to bounce the admin to /login as well -- on a slow or flaky
 * connection that looked like being logged out at random. Now it is "unreachable" (SWR keeps
 * retrying in the background), and an admin already confirmed stays in on a failed re-check.
 */
export function useAdminGate(): GateStatus {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const { mutate } = useSWRConfig();

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setHasSession(Boolean(session));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setHasSession(Boolean(session));
      mutate(ME_KEY);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [mutate]);

  const { data, error, isLoading } = useSWR(hasSession ? ME_KEY : null, () => getMe(), {
    revalidateOnFocus: false,
  });

  if (hasSession === null || (hasSession && isLoading && !data)) return "checking";
  if (!hasSession) return "signed-out";
  if (error && isAuthRejection(error)) return "signed-out";
  if (data) {
    const roles: string[] = data.data.roles ?? [];
    return roles.includes("admin") ? "admin" : "not-admin";
  }
  return error ? "unreachable" : "checking";
}

function isAuthRejection(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 401 || status === 403;
}
