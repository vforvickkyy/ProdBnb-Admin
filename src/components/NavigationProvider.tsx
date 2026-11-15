"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { internalTarget, NAVIGATION_START_EVENT } from "@/lib/navigation";

interface NavigationState {
  /** "/path?query" of the page being opened, or null when nothing is in flight. */
  pendingHref: string | null;
  /** True once a navigation to a *different page* (not just new query params) has been in flight for a moment. */
  showSkeleton: boolean;
}

const NavigationContext = createContext<NavigationState>({ pendingHref: null, showSkeleton: false });

/** Below this, a navigation finishes before a skeleton would only flash. */
const SKELETON_DELAY_MS = 120;
/** If a navigation never lands (offline, server error), stop pretending it is still coming. */
const GIVE_UP_MS = 20_000;

function isPlainLeftClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * Tracks the navigation in flight -- see src/lib/navigation.ts for why. Starts on any in-app link
 * click (capture phase, so it runs before the click is handled) or a router call announced through
 * the console's `useRouter`; ends when the URL actually changes.
 */
export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // Landed: the URL changed (or the user went back/forward).
  useEffect(() => {
    setPendingHref(null);
    setShowSkeleton(false);
  }, [pathname, search]);

  useEffect(() => {
    function start(target: string) {
      setPendingHref(target);
    }
    function onClick(event: MouseEvent) {
      if (!isPlainLeftClick(event)) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.dataset.noProgress !== undefined) return;
      const target = internalTarget(anchor.getAttribute("href") ?? "");
      if (target) start(target);
    }
    function onAnnounce(event: Event) {
      const target = (event as CustomEvent<string>).detail;
      if (typeof target === "string") start(target);
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener(NAVIGATION_START_EVENT, onAnnounce);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAVIGATION_START_EVENT, onAnnounce);
    };
  }, []);

  useEffect(() => {
    if (!pendingHref) return;
    const differentPage = pendingHref.split("?")[0] !== pathnameRef.current;
    const skeleton = differentPage ? window.setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS) : undefined;
    const giveUp = window.setTimeout(() => {
      setPendingHref(null);
      setShowSkeleton(false);
    }, GIVE_UP_MS);
    return () => {
      window.clearTimeout(skeleton);
      window.clearTimeout(giveUp);
    };
  }, [pendingHref]);

  return <NavigationContext.Provider value={{ pendingHref, showSkeleton }}>{children}</NavigationContext.Provider>;
}

export function useNavigationState(): NavigationState {
  return useContext(NavigationContext);
}

/** A thin indeterminate bar along the very top of the window while a page is on its way. */
export function NavigationProgressBar() {
  const { pendingHref } = useNavigationState();
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-200 ${pendingHref ? "opacity-100" : "opacity-0"}`}
    >
      {pendingHref && <div className="nav-progress-bar h-full w-full bg-accent-500" />}
    </div>
  );
}

/**
 * The URL the interface should reflect: the destination while a navigation is in flight (so the
 * sidebar and breadcrumb move the instant something is clicked), otherwise the current one.
 */
export function useEffectiveUrl(): { pathname: string | null; search: string } {
  const { pendingHref } = useNavigationState();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pendingHref) {
    const index = pendingHref.indexOf("?");
    return index === -1 ? { pathname: pendingHref, search: "" } : { pathname: pendingHref.slice(0, index), search: pendingHref.slice(index + 1) };
  }
  return { pathname, search: searchParams?.toString() ?? "" };
}
