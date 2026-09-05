"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import { useAdminGate } from "@/lib/useAdminGate";
import { clearSessionHint } from "@/lib/sessionHint";

/**
 * SWR's cache is a module-level singleton for the whole tab (Phase 14-B5) --
 * without this, a second admin signing in on the same tab without a full
 * reload could briefly see the previous admin's cached list/detail data via
 * stale-while-revalidate before their own request replaces it. The matcher
 * form of the documented global-mutate pattern (`() => true`) clears every
 * key; `revalidate: false` is deliberate, since there's no valid session to
 * revalidate against once signOut() below has run anyway.
 */
async function signOutAndRedirect(router: ReturnType<typeof useRouter>) {
  await supabase.auth.signOut();
  clearSessionHint();
  await mutate(() => true, undefined, { revalidate: false });
  router.replace("/login");
}

/**
 * Shared page shell: redirects a signed-out caller to /login, shows a clear
 * "not an admin" state for an authenticated non-admin (this is UX only --
 * they never had a way to fetch real admin data in the first place, since
 * the backend itself would already have rejected any /v1/admin/* call with
 * a 403), and renders the sidebar + page content once confirmed admin.
 *
 * The signed-out redirect runs inside an effect (Phase 14) -- it used to
 * call router.replace() directly during render, a React anti-pattern (a
 * side effect during render) that happened to work but is fragile under
 * concurrent rendering.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const status = useAdminGate();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-out") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "checking" || status === "signed-out") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500" role="status">
        Checking session…
      </div>
    );
  }

  if (status === "not-admin") {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <p role="alert" className="text-red-700">
            This account does not have admin access.
          </p>
          <button
            type="button"
            className="mt-4 text-sm text-slate-600 underline hover:text-slate-900"
            onClick={() => signOutAndRedirect(router)}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg focus:ring-2 focus:ring-slate-500"
      >
        Skip to main content
      </a>
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <MobileNav />
            <span className="font-semibold">ProdBnb Admin</span>
          </div>
          <button
            type="button"
            className="text-sm text-slate-500 hover:text-slate-800"
            onClick={() => signOutAndRedirect(router)}
          >
            Sign out
          </button>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
