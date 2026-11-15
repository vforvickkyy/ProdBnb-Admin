"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { mutate } from "swr";
import { ChevronRight, Moon, RefreshCw, Search, Sun } from "lucide-react";
import { CommandPalette } from "@/components/CommandPalette";
import { MobileNav } from "@/components/MobileNav";
import { NavigationProgressBar, NavigationProvider, useEffectiveUrl, useNavigationState } from "@/components/NavigationProvider";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Sidebar } from "@/components/Sidebar";
import { useTheme } from "@/components/ThemeProvider";
import { supabase } from "@/lib/supabase";
import { useAdminGate } from "@/lib/useAdminGate";
import { useAdminMe } from "@/lib/useAdminMe";
import { consoleEnvironment } from "@/lib/config";
import { cn } from "@/lib/cn";
import { findActive } from "@/lib/nav";
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
 * Console 3: rendered once by src/app/(console)/layout.tsx and kept mounted across navigations
 * (it used to be re-created by every page), with the Supabase-style rail + section menu, a header
 * breadcrumb, and instant feedback for every navigation (src/lib/navigation.ts).
 *
 * The signed-out redirect runs inside an effect (Phase 14) -- it used to
 * call router.replace() directly during render, a React anti-pattern (a
 * side effect during render) that happened to work but is fragile under
 * concurrent rendering.
 */
const ENV_BADGE: Record<string, { label: string; className: string }> = {
  local: { label: "Local", className: "bg-slate-100 text-slate-600" },
  staging: { label: "Staging", className: "bg-amber-50 text-amber-700" },
  production: { label: "Production", className: "bg-red-50 text-red-700" },
  unknown: { label: "Custom backend", className: "bg-slate-100 text-slate-600" },
};

function relativeTime(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

/** "Updated 2m ago ⟳" -- re-fetches everything on screen (every SWR key) in one go. */
function RefreshButton() {
  const pathname = usePathname();
  const [at, setAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAt(Date.now());
    setNow(Date.now());
  }, [pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      await mutate(() => true);
    } finally {
      setAt(Date.now());
      setNow(Date.now());
      setBusy(false);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={busy}
      aria-label="Refresh data"
      className="flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:cursor-wait"
    >
      <span className="hidden whitespace-nowrap sm:inline">{busy ? "Refreshing…" : `Updated ${relativeTime(at, now)}`}</span>
      <RefreshCw aria-hidden className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
    </button>
  );
}

function ThemeQuickToggle() {
  const { resolved, setChoice } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  const Icon = resolved === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => setChoice(next)}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
    >
      <Icon aria-hidden className="h-4 w-4" />
    </button>
  );
}

/** Section › page (› details) for wherever the admin is -- or is about to be. */
function Breadcrumb() {
  const { pathname, search } = useEffectiveUrl();
  const active = findActive(pathname, search);
  if (!active) return <span className="truncate text-sm font-medium text-slate-900">ProdBnb Admin</span>;
  const Icon = active.section.icon;
  const itemPath = active.item.href.split("?")[0]!;
  const deeper = pathname && pathname !== itemPath ? (pathname.endsWith("/edit") ? "Edit" : "Details") : null;
  const sameName = active.section.label === active.item.label;
  return (
    <ol className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      <li className="flex shrink-0 items-center gap-2 text-slate-500">
        <Icon aria-hidden className="h-4 w-4" />
        <span className={cn(sameName && !deeper ? "font-medium text-slate-900" : "hidden sm:inline")}>{active.section.label}</span>
      </li>
      {!sameName && (
        <li className="flex min-w-0 items-center gap-1.5">
          <ChevronRight aria-hidden className="hidden h-3.5 w-3.5 shrink-0 text-slate-300 sm:block" />
          <span className={cn("truncate", deeper ? "text-slate-500" : "font-medium text-slate-900")}>{active.item.label}</span>
        </li>
      )}
      {deeper && (
        <li className="flex shrink-0 items-center gap-1.5">
          <ChevronRight aria-hidden className="h-3.5 w-3.5 text-slate-300" />
          <span className="font-medium text-slate-900" aria-current="page">
            {deeper}
          </span>
        </li>
      )}
    </ol>
  );
}

/** The page, or -- while a navigation to another page is in flight -- a skeleton of one. */
function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { showSkeleton, pendingHref } = useNavigationState();
  return (
    <main key={pathname} id="main-content" className="mx-auto w-full max-w-[1240px] flex-1 animate-page-in px-4 py-6 sm:px-8 sm:py-8">
      <span role="status" aria-live="polite" className="sr-only">
        {pendingHref ? "Loading page…" : ""}
      </span>
      {showSkeleton && <PageSkeleton />}
      <div hidden={showSkeleton}>{children}</div>
    </main>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <NavigationProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </NavigationProvider>
  );
}

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const status = useAdminGate();
  const router = useRouter();
  const { me, permissions, can } = useAdminMe(status === "admin");
  const env = ENV_BADGE[consoleEnvironment()] ?? ENV_BADGE.unknown!;
  const signOut = useCallback(() => void signOutAndRedirect(router), [router]);

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

  if (status === "unreachable") {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div role="alert" className="max-w-sm text-center">
          <span aria-hidden className="mx-auto mb-4 block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-accent-500" />
          <p className="text-sm font-medium text-slate-900">Can&apos;t reach ProdBnb right now</p>
          <p className="mt-1 text-sm text-slate-500">Your connection or the server is slow. Retrying automatically — you are still signed in.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => void mutate("/v1/me")}
              className="h-8 rounded-lg bg-accent-500 px-3 text-[13px] font-medium text-snow shadow-sm hover:bg-accent-600"
            >
              Retry now
            </button>
            <button type="button" onClick={signOut} className="h-8 rounded-lg px-3 text-[13px] text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              Sign out
            </button>
          </div>
        </div>
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
            onClick={signOut}
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
        data-no-progress
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-pop focus:ring-2 focus:ring-accent-400"
      >
        Skip to main content
      </a>
      <NavigationProgressBar />
      <div className="sticky top-0 z-30 hidden h-screen md:block">
        <Sidebar permissions={permissions} me={me} onSignOut={signOut} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
          <MobileNav permissions={permissions} me={me} onSignOut={signOut} />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Breadcrumb />
            <span className={cn("hidden shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-medium sm:inline-flex", env.className)}>{env.label}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("prodbnb:open-palette"))}
              className="mr-1 hidden h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 lg:flex lg:w-60"
            >
              <Search aria-hidden className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">Search or jump to…</span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 font-sans text-2xs text-slate-500">⌘K</kbd>
            </button>
            <button
              type="button"
              aria-label="Search or jump to"
              onClick={() => window.dispatchEvent(new Event("prodbnb:open-palette"))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            >
              <Search aria-hidden className="h-4 w-4" />
            </button>
            <RefreshButton />
            <ThemeQuickToggle />
          </div>
        </header>
        <MainContent>{children}</MainContent>
        <CommandPalette permissions={permissions} can={can} />
      </div>
    </div>
  );
}
