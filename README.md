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

Next.js (App Router) + TypeScript + Tailwind CSS, [SWR](https://swr.vercel.app) for data fetching/
caching, [Radix UI Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) for
accessible modals, and [Sonner](https://sonner.emilkowal.ski) for toasts. API request/response
types (`src/types/admin-api.d.ts`) are generated from the backend's own OpenAPI contract via
[`openapi-typescript`](https://openapi-ts.dev), consumed through
[`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) (`src/lib/api.ts`) so a backend schema
change that isn't reflected here becomes a type error at build time. Response *bodies*, not just
request shapes, are fully typed as of Phase 14 (the backend's generator now registers real zod
response schemas), so pages consume real types instead of casting from `unknown`.

**Route protection**: `middleware.ts` does a basic session-presence check via a lightweight,
non-sensitive marker cookie (`src/lib/sessionHint.ts`) — this project's Supabase client persists
sessions to `localStorage`, which edge middleware can never read, so this is the cheapest available
way to stop the app shell rendering before the real client-side gate resolves. It is **not** a
security boundary: the actual authorization is still `requireRole('admin')` on the backend
(`src/lib/useAdminGate.ts`'s own check is UI-only) and remains completely unchanged by this cookie.

**`src/types/admin-api.d.ts` is committed, not gitignored** (Phase 13) — `generate:api-types`
reads the backend's OpenAPI doc via a relative sibling-directory path
(`../ProdBnb Backend/docs/admin-openapi.json`), which only resolves on a machine with both repos
checked out side by side. A CI/deploy pipeline that only clones this repo has no way to produce
that file otherwise, so it has to already be in git. This isn't a second source of truth: the
backend's own CI regenerates `docs/admin-openapi.json` from its zod schemas and fails the build if
the committed spec has drifted, and this repo's `npm run typecheck` fails if a stale `.d.ts` no
longer matches how `src/lib/api.ts` actually uses it. Regenerating and committing the result after
any admin API change is still a deliberate, manual step — run `npm run generate:api-types` and
commit what it produces.

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
middleware.ts     Basic session-presence check (see "Route protection" above)
src/
  app/            One folder per route (App Router):
                    dashboard, moderation (queue), locations, bookings (+ [id]),
                    payments (+ [id], refunds), users, audit-log, login
  components/
    AdminShell.tsx  Sidebar + header + the client-side admin gate
    Sidebar.tsx     Navigation
    ui/             Shared primitives: Table, Badge, Dialog, ConfirmDialog, Pagination,
                    SearchInput, Skeleton, EmptyState, ErrorState
  lib/
    supabase.ts     Sign-in only — never used to query Supabase tables directly
    api.ts          Typed client for /v1/admin/* (openapi-fetch + generated types),
                    unwrap()/unwrapPaginated() envelope helpers, authorizedFetch() for /v1/me
    useAdminGate.ts UI-only "is this session an admin" check, backed by SWR
    useAdminList.ts Shared paginated-list data-fetching hook
    sessionHint.ts  The middleware marker cookie described above
  types/            Generated from the backend's OpenAPI contract (committed — see "Stack" above)
e2e/                Playwright end-to-end specs (see "Testing" below)
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run build` | Production build (`next build`) |
| `npm run typecheck` | Type-check without building |
| `npm run lint` | ESLint (`next/core-web-vitals` + `next/typescript`) |
| `npm test` | Run the Vitest component/unit suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright suite against a deployed environment — see below |
| `npm run generate:api-types` | Regenerate `src/types/admin-api.d.ts` from the backend's `docs/admin-openapi.json` |

## Testing

**Unit/component** (Vitest + React Testing Library, `src/**/*.test.{ts,tsx}`): covers the shared UI
primitives (e.g. a destructive `ConfirmDialog` can't be confirmed without a reason when one is
required), the `unwrap`/`unwrapPaginated` API envelope helpers, and every state of
`useAdminGate` (signed-out, not-admin, admin, and a failed `/v1/me` call degrading to signed-out
rather than crashing). Runs in CI (`.github/workflows/ci.yml`) on every push/PR, alongside
typecheck/lint/build.

**End-to-end** (Playwright, `e2e/`): exercises the real login → dashboard → navigate-every-section →
sign-out flow against a real deployed environment (staging by default). Requires a real admin
account's credentials passed as environment variables at run time — never hardcoded, never
committed — and skips itself cleanly when they're absent:

```bash
E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
```

Deliberately **not** wired into CI (it needs a live staging admin account's real credentials as
secrets, which is a separate setup decision) — run it manually before/after a staging deploy.

## Deployment

Deployed on [Vercel](https://vercel.com) — one Project per environment (staging, production), each
pointing at its own backend/Supabase project via the three `NEXT_PUBLIC_*` variables (they're
baked into the browser bundle at **build** time, so changing one requires a new build, not just a
redeploy of the same build). No server-side secrets are ever involved in deployment — see "What
this project never holds" above. The backend's `CORS_ORIGINS` for the matching environment must
include this app's deployed origin, or every API call from the browser fails preflight. See the
backend repo's `docs/DEPLOYMENT.md` for the full staging/production setup.

## Status

**Phase 14-A** (critical ops core): dashboard, moderation queue, locations, bookings (list +
detail + cancel), payments (list + detail + refund) and refunds, and a fully filterable audit log
are built against the backend's complete `/v1/admin/*` surface, with real pagination, debounced
search, accessible dialogs replacing `window.prompt`/`window.alert`, toasts, loading skeletons, and
empty/error states throughout. Test infrastructure (Vitest + Testing Library + Playwright), ESLint,
and CI were stood up from nothing as part of this phase.

**Phase 14-B** (not yet built): dedicated user/location detail pages (suspend/restore and
approve/reject currently act inline from their list pages), a Hosts-specific view (today just a
`role=host`-filtered link into Users), notification delivery-diagnostics panels embedded in
booking/user detail, a System Health page (the backend's `GET /v1/admin/system/status` endpoint
already exists), and a full accessibility/responsive pass beyond the baseline (labeled forms,
table semantics, focus-trapped dialogs, tablet-width table scrolling) already in place.
