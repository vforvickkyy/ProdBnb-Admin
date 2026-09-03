"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type GateStatus = "checking" | "signed-out" | "not-admin" | "admin";

/**
 * UI gating only -- "am I an admin" here decides whether to render admin
 * screens or bounce to /login, never an authorization decision. The real
 * boundary is server-side: every /v1/admin/* call still requires
 * requireRole('admin') on the backend regardless of what this hook renders
 * (docs/ARCHITECTURE.md in the backend repo).
 */
export function useAdminGate(): GateStatus {
  const [status, setStatus] = useState<GateStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setStatus("signed-out");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        if (!cancelled) setStatus("signed-out");
        return;
      }
      const body = await res.json();
      const roles: string[] = body.data?.roles ?? [];
      if (!cancelled) setStatus(roles.includes("admin") ? "admin" : "not-admin");
    }

    check();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return status;
}
