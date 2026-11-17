"use client";

import createClient from "openapi-fetch";
import type { paths } from "@/types/admin-api";
import { supabase } from "./supabase";

// The one place a Supabase access token is read for an outgoing request --
// every other call site in this app goes through either `adminApi` or
// `authorizedFetch` below, both of which use this. Reads the session fresh
// on every call (not captured once at module load), so a token refresh
// mid-session is picked up automatically. Previously duplicated three times
// (adminApi's own middleware, useAdminGate, and two pages' hand-rolled
// fetch calls) -- collapsed here (Phase 14).
async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// A typed client generated from the backend's own OpenAPI contract
// (docs/admin-openapi.json in the ProdBnb Backend repo -> `npm run
// generate:api-types` here) -- request/response shapes are never
// hand-copied between the two repositories, so a backend schema change
// that isn't reflected here shows up as a type error at build time, not a
// silent runtime mismatch discovered by a user. Every /v1/admin/* endpoint
// is in this contract as of Phase 14 (including the two, `/users` and
// `/locations`, that predate the OpenAPI doc but were already registered in
// the generator -- only /v1/me sits outside it, since it isn't admin-scoped
// at all; see authorizedFetch below).
export const adminApi = createClient<paths>({ baseUrl: `${API_BASE_URL}/v1/admin` });

adminApi.use({
  async onRequest({ request }) {
    const token = await getAccessToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
  },
});

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * For the one endpoint outside the admin OpenAPI contract (`/v1/me`, not
 * admin-scoped -- every authenticated user of the whole platform has one).
 * Throws an ApiError shaped so extractErrorMessage() (ErrorState.tsx) reads
 * it the same way as an adminApi `error`, so error handling doesn't fork
 * depending on which client a given call happens to use.
 */
export async function authorizedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.message ?? `Request failed (${res.status}).`, body?.error?.code);
  }
  return body as T;
}

/**
 * openapi-fetch never throws -- it returns { data, error } for every call.
 * SWR (and any other throw-based consumer) expects a rejected promise on
 * failure instead, so every list/detail page funnels its adminApi call
 * through this rather than re-deriving the same `if (error) throw` each
 * time. Every registered response schema wraps its real shape in `{ data:
 * ... }` (see generate-openapi.ts's okResponse/paginatedResponse), so
 * openapi-fetch's own `data` field is itself `{ data: T }` (or `{ data: T[],
 * meta }` for a paginated list) -- unwrap() peels that one envelope level
 * off so every call site gets the real shape directly.
 */
export function unwrap<T>(result: { data?: { data: T; meta?: unknown }; error?: unknown; response: Response }): T {
  const { data, error, response } = result;
  if (error !== undefined || data === undefined) {
    const body = error as { error?: { message?: string; code?: string } } | undefined;
    throw new ApiError(response.status, body?.error?.message ?? `Request failed (${response.status}).`, body?.error?.code);
  }
  return data.data;
}

/** Same as unwrap(), but also returns the pagination meta for list endpoints. */
export function unwrapPaginated<T>(result: {
  data?: { data: T[]; meta: { page: number; pageSize: number; total: number } };
  error?: unknown;
  response: Response;
}): { data: T[]; meta: { page: number; pageSize: number; total: number } } {
  const { data, error, response } = result;
  if (error !== undefined || data === undefined) {
    const body = error as { error?: { message?: string; code?: string } } | undefined;
    throw new ApiError(response.status, body?.error?.message ?? `Request failed (${response.status}).`, body?.error?.code);
  }
  return data;
}

export interface MeResponse {
  data: {
    profile: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; status: string };
    roles: string[];
  };
}

export function getMe(): Promise<MeResponse> {
  return authorizedFetch<MeResponse>("/v1/me");
}

/** Fetches a file (e.g. an invoice PDF) from the admin API with the session token. */
export async function fetchAdminFile(path: string, init?: RequestInit): Promise<Blob> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE_URL}/v1/admin${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.message ?? `Request failed (${res.status}).`, body?.error?.code);
  }
  return res.blob();
}

/** Downloads an admin API file to the viewer's computer under `filename`. */
export async function downloadAdminFile(path: string, filename: string): Promise<void> {
  const blob = await fetchAdminFile(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
