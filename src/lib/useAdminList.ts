"use client";

import useSWR from "swr";

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

/**
 * One shared shape for every paginated admin list page (Phase 14) --
 * previously each page hand-rolled its own useState/useEffect fetch with no
 * caching, no dedup, and no shared error handling. `key` should include
 * every filter/page value that affects the request, exactly like a normal
 * SWR key; pass `null` to skip fetching (e.g. while a required filter like
 * notification_id is unset).
 */
export function useAdminList<T>(key: string | null, fetcher: () => Promise<PaginatedResponse<T>>) {
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, { revalidateOnFocus: false, keepPreviousData: true });

  return {
    rows: data?.data ?? [],
    meta: data?.meta,
    isLoading,
    error,
    refresh: mutate,
  };
}
