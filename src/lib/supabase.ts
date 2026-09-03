"use client";

import { createClient } from "@supabase/supabase-js";

// Sign-in only. Every privileged marketplace read/write goes through the
// backend's own authenticated /v1/admin/* API (see api.ts) -- this client
// is never used to query Supabase tables directly, and the key it holds
// (NEXT_PUBLIC_SUPABASE_ANON_KEY) is the same public, RLS-constrained key
// every other ProdBnb client (iOS, the backend's own anon client) already
// ships. The service-role key never exists anywhere in this project.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
