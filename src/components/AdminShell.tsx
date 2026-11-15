"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { mutate } from "swr";
import { LogOut, Search } from "lucide-react";
import { CommandPalette } from "@/components/CommandPalette";
import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import { useAdminGate } from "@/lib/useAdminGate";
import { TEAM_ROLE_LABELS, useAdminMe } from "@/lib/useAdminMe";
import { consoleEnvironment } from "@/lib/config";
import { cn } from "@/lib/cn";
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
const ENV_BADGE: Record<string, { label: string; className: string }> = {
  local: { label: "Local", className: "bg-slate-100 text-slate-700 ring-slate-300" },
  staging: { label: "Staging", className: "bg-brand-50 text-brand-800 ring-brand-200" },
  production: { label: "Production", className: "bg-red-50 text-red-700 ring-red-200" },
  unknown: { label: "Custom backend", className: "bg-slate-100 text-slate-700 ring-slate-300" },
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const status = useAdminGate();
  const router = useRouter();
  const pathname = usePathname();
  const { me, permissions, can } = useAdminMe(status === "admin");
  const env = ENV_BADGE[consoleEnvironment()] ?? ENV_BADGE.unknown!;

  useEffect(() => {
    if (status === "signed-out") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "checking" || status === "signed-out") {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-slate-500" role="status">
        <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
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
      <div className="sticky top-0 hidden h-screen md:block">
        <Sidebar permissions={permissions} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNav permissions={permissions} />
            <span className="font-semibold md:hidden">ProdBnb Admin</span>
            <span className={cn("hidden rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset sm:inline-flex", env.className)}>{env.label}</span>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("prodbnb:open-palette"))}
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 lg:flex lg:w-72"
            >
              <Search aria-hidden className="h-4 w-4" />
              <span className="flex-1 text-left">Search or jump to…</span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-500">⌘K</kbd>
            </button>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              aria-label="Search or jump to"
              onClick={() => window.dispatchEvent(new Event("prodbnb:open-palette"))}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden"
            >
              <Search aria-hidden className="h-4 w-4" />
            </button>
            <ThemeToggle />
            {me && (
              <div className="hidden min-w-0 items-center gap-2 sm:flex">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold uppercase text-brand-800"
                >
                  {(me.first_name?.[0] ?? me.email?.[0] ?? "A") + (me.last_name?.[0] ?? "")}
                </span>
                <div className="min-w-0 text-left">
                  <div className="truncate text-sm font-medium leading-tight text-slate-800">
                    {[me.first_name, me.last_name].filter(Boolean).join(" ") || me.email || "Admin"}
                  </div>
                  <div className="text-xs leading-tight text-slate-500">{TEAM_ROLE_LABELS[me.team_role]}</div>
                </div>
              </div>
            )}
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              onClick={() => signOutAndRedirect(router)}
            >
              <LogOut aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </header>
        {/* Keyed by path so each page eases in on navigation (disabled under prefers-reduced-motion). */}
        <main key={pathname} id="main-content" className="mx-auto w-full max-w-7xl flex-1 animate-page-in px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <CommandPalette permissions={permissions} can={can} />
      </div>
    </div>
  );
}
