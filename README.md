# ProdBnb Admin

The operational admin panel for the ProdBnb marketplace — a **separate frontend project**, never
built inside the [ProdBnb Backend](../ProdBnb%20Backend) repository. It signs in through the same
Supabase Auth project as every other ProdBnb client (iOS, the backend itself) and calls the
backend's authenticated `/v1/admin/*` REST API for everything else. See the backend repo's
[`docs/DATABASE.md`](../ProdBnb%20Backend/docs/DATABASE.md#admin-control--admin-panel-phase-11)
for the full architecture.

## What this project never holds

`SUPABASE_SERVICE_ROLE_KEY`, `CASHFREE_SECRET_KEY`, `APNS_PRIVATE_KEY`, or any R2/webhook secret.
Every environment variable here is `NEXT_PUBLIC_*` on purpose — the Supabase anon key and the
backend's own base URL are the only configuration this project needs, and both are safe to ship
to the browser (the same anon key every other ProdBnb client already ships). Authorization is
enforced **server-side** on every `/v1/admin/*` call (`requireRole('admin')`, backend repo) — this
project's own role check (`src/lib/useAdminGate.ts`) is UI gating only, never the real boundary.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS. API request/response types
(`src/types/admin-api.d.ts`, gitignored — regenerate, don't hand-copy) are generated from the
backend's own OpenAPI contract via [`openapi-typescript`](https://openapi-ts.dev), consumed
through [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) (`src/lib/api.ts`) so a backend
schema change that isn't reflected here becomes a type error at build time.

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Regenerate API types from the backend's current OpenAPI contract
#    (run this again any time the backend's admin surface changes)
npm run generate:api-types

# 3. Configure environment
cp .env.local.example .env.local
# Fill in your local Supabase anon key (`supabase status` in the backend repo)

# 4. Make sure the ProdBnb Backend's own dev server is running (separate
#    terminal, in the backend repo):
#    npm run dev   # -> http://localhost:4000

# 5. Run this app
npm run dev
# -> http://localhost:3000
```

Sign in with an account that holds the ProdBnb `admin` role (granted via direct database access
in the backend project — see that repo's `docs/DATABASE.md#granting-the-admin-role`, there is no
self-service way to grant it, deliberately).

## Project structure

```
src/
  app/            One folder per route (App Router) — dashboard, users, locations, login
  components/     Shared UI (AdminShell: nav + the client-side admin gate)
  lib/
    supabase.ts   Sign-in only — never used to query Supabase tables directly
    api.ts        Typed client for /v1/admin/* (openapi-fetch + generated types)
    useAdminGate.ts   UI-only "is this session an admin" check
  types/          Generated from the backend's OpenAPI contract (gitignored)
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run build` | Production build (also type-checks and lints) |
| `npm run typecheck` | Type-check without building |
| `npm run generate:api-types` | Regenerate `src/types/admin-api.d.ts` from the backend's `docs/admin-openapi.json` |

## Status

Initial scaffold (dashboard, users, locations pages) verified end-to-end against the real ProdBnb
backend and local Supabase stack — sign-in, the admin role gate, and typed API calls all confirmed
working. Bookings, payments/refunds, notification diagnostics, and audit log pages follow the same
pattern and can be added incrementally; the backend already exposes the full `/v1/admin/*` surface
these would consume.
