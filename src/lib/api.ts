"use client";

import createClient from "openapi-fetch";
import type { paths } from "@/types/admin-api";
import { supabase } from "./supabase";

// A typed client generated from the backend's own OpenAPI contract
// (docs/admin-openapi.json in the ProdBnb Backend repo -> `npm run
// generate:api-types` here) -- request/response shapes are never
// hand-copied between the two repositories, so a backend schema change
// that isn't reflected here shows up as a type error at build time, not a
// silent runtime mismatch discovered by a user.
// The generated `paths` keys (e.g. "/dashboard") are relative to the
// OpenAPI doc's own `servers` entry (/v1/admin) -- combined here with the
// backend's own base URL to get the real request URL.
export const adminApi = createClient<paths>({ baseUrl: `${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/admin` });

// Registered once, at module load -- attaches the caller's CURRENT Supabase
// access token to every request, exactly the same way iOS/Android/Web are
// documented to authenticate against this backend (docs/ARCHITECTURE.md in
// the backend repo). The Admin Panel is just one more client of the same
// authentication model, not a second auth system. Reads the session fresh
// on each request (not captured once at module load), so a token refresh
// mid-session is picked up automatically.
adminApi.use({
  async onRequest({ request }) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      request.headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    return request;
  },
});
