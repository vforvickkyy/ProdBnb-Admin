"use client";

import useSWR from "swr";
import { adminApi, unwrap } from "@/lib/api";
import type { NavCountKey } from "@/lib/nav";
import type { AdminPermission } from "@/lib/useAdminMe";

/**
 * Live counts for the sidebar ("Host requests 3"). Fetched only once the admin's permissions are
 * known and include the page, refreshed every minute and whenever the tab comes back into focus.
 */
export function useNavCounts(permissions?: readonly AdminPermission[]): Partial<Record<NavCountKey, number>> {
  const allowed = permissions?.includes("host_requests.manage") ?? false;
  const { data } = useSWR(
    allowed ? "/v1/admin/host-requests/summary" : null,
    () => adminApi.GET("/host-requests/summary").then(unwrap<{ new: number; contacted: number }>),
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
  return data ? { hostRequests: data.new } : {};
}

/** "3", "99+", or nothing for zero. */
export function navCountLabel(count: number | undefined): string | null {
  if (!count || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}
