"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { supabase } from "@/lib/supabase";
import { useAdminGate } from "@/lib/useAdminGate";
import { clearSessionHint } from "@/lib/sessionHint";

async function signOutAndRedirect(router: ReturnType<typeof useRouter>) {
  await supabase.auth.signOut();
  clearSessionHint();
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
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <span className="font-semibold">ProdBnb Admin</span>
          <button
            type="button"
            className="text-sm text-slate-500 hover:text-slate-800"
            onClick={() => signOutAndRedirect(router)}
          >
            Sign out
          </button>
        </header>
        {/* Below md, the sidebar collapses entirely rather than overlapping
            content -- a compact drawer/icon-rail variant is 14-B scope. */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
