"use client";

import { useMemo } from "react";
import { useRouter as useNextRouter } from "next/navigation";

/**
 * Instant navigation feedback (Console 3).
 *
 * Every console page renders per request (`force-dynamic`, for the CSP nonce), so a click on a
 * slow connection used to do nothing visible until the server answered -- the console looked hung.
 * Now anything that starts a navigation announces it at once; the shell's NavigationProvider shows a
 * progress bar, moves the sidebar highlight and breadcrumb to the destination, and swaps in a page
 * skeleton, until the new URL is actually live.
 *
 * Links are picked up automatically (a document-level click listener). Code that navigates through
 * the router should use this `useRouter` instead of next/navigation's -- same API, plus the
 * announcement.
 */
export const NAVIGATION_START_EVENT = "prodbnb:navigation-start";

export function announceNavigation(href: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(NAVIGATION_START_EVENT, { detail: href }));
}

/** Resolve an href the way the browser would; null for anything that is not an in-app page change. */
export function internalTarget(href: string, base: string = window.location.href): string | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  const current = new URL(base);
  if (url.origin !== current.origin) return null;
  const target = `${url.pathname}${url.search}`;
  if (target === `${current.pathname}${current.search}`) return null; // same page (or a #hash jump)
  return target;
}

type NextRouter = ReturnType<typeof useNextRouter>;

export function useRouter(): NextRouter {
  const router = useNextRouter();
  return useMemo<NextRouter>(
    () => ({
      ...router,
      push: (href, options) => {
        const target = typeof window === "undefined" ? null : internalTarget(href);
        if (target) announceNavigation(target);
        router.push(href, options);
      },
      replace: (href, options) => {
        const target = typeof window === "undefined" ? null : internalTarget(href);
        if (target) announceNavigation(target);
        router.replace(href, options);
      },
    }),
    [router],
  );
}
