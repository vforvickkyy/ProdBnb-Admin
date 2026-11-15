"use client";

import useSWR from "swr";
import { adminApi, unwrap } from "@/lib/api";
import type { components, paths } from "@/types/admin-api";

export type MessagingOverview = paths["/messaging/overview"]["get"]["responses"]["200"]["content"]["application/json"]["data"];
export type ChannelStatus = components["schemas"]["ChannelStatus"];
export type Campaign = components["schemas"]["Campaign"];

export function useMessagingOverview() {
  return useSWR("/v1/admin/messaging/overview", () => adminApi.GET("/messaging/overview").then(unwrap<MessagingOverview>));
}

export const CHANNEL_LABEL: Record<string, string> = { smtp: "Email (SMTP)", apns: "iOS push (APNs)", fcm: "Android push (FCM)", webpush: "Web push" };
