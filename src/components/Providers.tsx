"use client";

import { SWRConfig } from "swr";

/**
 * layout.tsx is a Server Component (it exports `metadata`, which a Client
 * Component can't do), but SWRConfig's context provider only works from a
 * Client Component -- this is the standard Next.js App Router pattern for
 * that split, not a new caching mechanism (Phase 14-B5).
 *
 * `revalidateOnFocus: false` here makes SWR behavior consistent app-wide:
 * useAdminList/useAdminGate already set this per-hook, but every plain
 * useSWR call (every detail page's main fetch, System Health, Dashboard)
 * previously fell back to SWR's own default of `true`, causing an
 * unnecessary revalidation fetch every time an admin switched back to a
 * tab. Per-hook options (e.g. keepPreviousData) still override this default
 * exactly as SWR's own precedence rules already work.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ revalidateOnFocus: false }}>{children}</SWRConfig>;
}
