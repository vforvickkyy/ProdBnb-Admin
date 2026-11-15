"use client";

import useSWR from "swr";
import { adminApi, unwrap } from "./api";
import type { components } from "@/types/admin-api";

export type AdminMe = components["schemas"]["AdminMe"];
export type AdminPermission = AdminMe["permissions"][number];
export type TeamRole = AdminMe["team_role"];

export const ADMIN_ME_KEY = "/v1/admin/me";

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  super_admin: "Super admin",
  moderator: "Moderator",
  support: "Support",
  finance: "Finance",
};

export const TEAM_ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  super_admin: "Everything, including the team, platform settings and integrations.",
  moderator: "Listings and people: approve, reject, suspend, edit listings and photos, catalog, user roles.",
  support: "Bookings and disputes: booking actions, re-checking payments, reading conversations for a reason.",
  finance: "Money: payments, refunds and analytics.",
};

/**
 * The signed-in admin's team role and permissions, straight from the backend (GET /v1/admin/me) --
 * this app never keeps its own copy of the permission matrix. UI gating only: the backend enforces
 * the same permission on every call regardless of what is rendered here.
 */
export function useAdminMe(enabled = true) {
  const { data, error, isLoading } = useSWR(enabled ? ADMIN_ME_KEY : null, () => adminApi.GET("/me").then(unwrap<AdminMe>), {
    revalidateOnFocus: false,
  });
  const permissions = data?.permissions;
  return {
    me: data,
    error,
    isLoading,
    permissions,
    /**
     * `true` while permissions are unknown (loading, or /me failed) -- the same rule the sidebar
     * uses -- so controls never flash away and back, and the console stays usable against a backend
     * that can't answer /me. Hiding is a courtesy; the server refuses a disallowed action regardless.
     */
    can: (permission: AdminPermission) => (permissions ? permissions.includes(permission) : true),
  };
}
