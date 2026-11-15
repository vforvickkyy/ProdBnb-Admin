"use client";

import { authorizedFetch } from "./api";

/**
 * Admin Console 2: the SHARED listing endpoints (/v1/locations/:id/...) a host's app uses to manage
 * photos, pricing, timings and sections. The backend lets an administrator with
 * `locations.moderate` act on any listing through these same doors (and audits it), so the editor
 * talks to them directly instead of duplicating every one under /v1/admin. They are outside the
 * generated admin OpenAPI types, hence these hand-written shapes (mirroring the backend services).
 */

export interface MediaItem {
  id: string;
  media_type: "photo" | "video";
  url: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface UploadAuthorization {
  media_id: string;
  upload_url: string;
  method: "PUT";
  headers: Record<string, string>;
  expires_at: string;
}

export type BookingType = "hourly" | "half_day" | "day" | "multi_day";

export interface Pricing {
  id: string;
  location_id: string;
  booking_type: BookingType;
  amount_minor_units: number;
  currency: string;
  half_day_duration_hours: number | null;
  is_active: boolean;
}

export type DayOfWeek = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export interface AvailabilityRule {
  id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
}

export interface AvailabilityOverride {
  id: string;
  date: string;
  status: "available" | "unavailable";
  start_time: string | null;
  end_time: string | null;
}

export interface BlockedPeriod {
  id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
}

export interface Section {
  id: string;
  name: string;
  description: string | null;
  cover: MediaItem | null;
  photo_count: number;
}

type Envelope<T> = { data: T };

const base = (id: string) => `/v1/locations/${id}`;
const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

async function get<T>(path: string): Promise<T> {
  return (await authorizedFetch<Envelope<T>>(path)).data;
}
async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  return (await authorizedFetch<Envelope<T>>(path, { method, ...(body !== undefined ? json(body) : {}) })).data;
}

export const listingApi = {
  // Media (general gallery = no section)
  media: (id: string) => get<MediaItem[]>(`${base(id)}/media`),
  sectionMedia: (id: string, sectionId: string) => get<MediaItem[]>(`${base(id)}/sections/${sectionId}/media`),
  requestUpload: (id: string, body: { media_type: "photo" | "video"; content_type: string; size_bytes: number }) =>
    send<UploadAuthorization>("POST", `${base(id)}/media/upload`, body),
  completeUpload: (id: string, mediaId: string, sectionId: string | null) =>
    send<MediaItem>("POST", `${base(id)}/media/${mediaId}/complete`, sectionId ? { section_id: sectionId } : {}),
  reorder: (id: string, orderedIds: string[], sectionId: string | null) =>
    send<MediaItem[]>("PUT", `${base(id)}/media/order`, { ordered_ids: orderedIds, ...(sectionId ? { section_id: sectionId } : {}) }),
  deleteMedia: (id: string, mediaId: string) => send<unknown>("DELETE", `${base(id)}/media/${mediaId}`),

  // Pricing
  pricing: (id: string) => get<Pricing[]>(`${base(id)}/pricing`),
  createPricing: (id: string, body: { booking_type: BookingType; amount_minor_units: number; currency?: string; half_day_duration_hours?: number }) =>
    send<Pricing>("POST", `${base(id)}/pricing`, body),
  updatePricing: (
    id: string,
    pricingId: string,
    body: Partial<Pick<Pricing, "amount_minor_units" | "currency" | "half_day_duration_hours" | "is_active">>,
  ) => send<Pricing>("PATCH", `${base(id)}/pricing/${pricingId}`, body),
  deletePricing: (id: string, pricingId: string) => send<unknown>("DELETE", `${base(id)}/pricing/${pricingId}`),

  // Timings
  rules: (id: string) => get<AvailabilityRule[]>(`${base(id)}/availability/rules`),
  createRule: (id: string, body: { day_of_week: DayOfWeek; start_time: string; end_time: string }) =>
    send<AvailabilityRule>("POST", `${base(id)}/availability/rules`, body),
  updateRule: (id: string, ruleId: string, body: Partial<{ day_of_week: DayOfWeek; start_time: string; end_time: string }>) =>
    send<AvailabilityRule>("PATCH", `${base(id)}/availability/rules/${ruleId}`, body),
  deleteRule: (id: string, ruleId: string) => send<unknown>("DELETE", `${base(id)}/availability/rules/${ruleId}`),
  overrides: (id: string) => get<AvailabilityOverride[]>(`${base(id)}/availability/overrides`),
  createOverride: (id: string, body: { date: string; status: "available" | "unavailable"; start_time?: string; end_time?: string }) =>
    send<AvailabilityOverride>("POST", `${base(id)}/availability/overrides`, body),
  deleteOverride: (id: string, overrideId: string) => send<unknown>("DELETE", `${base(id)}/availability/overrides/${overrideId}`),
  blocks: (id: string) => get<BlockedPeriod[]>(`${base(id)}/blocks`),
  createBlock: (id: string, body: { start_at: string; end_at: string; reason?: string | null }) =>
    send<BlockedPeriod>("POST", `${base(id)}/blocks`, body),
  deleteBlock: (id: string, blockId: string) => send<unknown>("DELETE", `${base(id)}/blocks/${blockId}`),

  // Sections
  sections: (id: string) => get<Section[]>(`${base(id)}/sections`),
  createSection: (id: string, body: { name: string; description?: string | null }) => send<Section>("POST", `${base(id)}/sections`, body),
  updateSection: (id: string, sectionId: string, body: { name?: string; description?: string | null }) =>
    send<Section>("PATCH", `${base(id)}/sections/${sectionId}`, body),

  // Status (admins may set any status through the shared PATCH; audited as ADMIN_UPDATED_LOCATION_STATUS)
  setStatus: (id: string, status: string) => send<unknown>("PATCH", base(id), { status }),
};
