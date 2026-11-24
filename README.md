# neutra

Monorepo for the Neutra multi-tenant commerce and booking platform. Bun
workspaces (`apps/*`, `packages/*`) orchestrated with turbo; a single `bun.lock`
lives at the root.

## Layout

- `apps/api/` — multi-tenant Express/TypeScript API (imported from
  `api-neutra-v2`, full git history preserved).
- `apps/cms/` — Strapi CMS (imported from `neutra-cms`, full git history preserved).
- `apps/web/` — React/TanStack front end (imported from `neutra-frontend`, full
  git history preserved, workspace name `web`). It consumes `@neutra/commons`
  via `workspace:*` as the single source of truth for wire contracts, and runs
  on Node 22 in production (bun is the installer/builder only).
- `packages/commons/` — `@neutra/commons`, the single source of truth for
  wire contracts shared between the API, the CMS and the web app.

## Root commands

| Command | Description |
| --- | --- |
| `bun install` | Install all workspace dependencies (generates `bun.lock`). |
| `bun run build` | Build API + commons via turbo (`^build` first); the CMS is excluded because its Strapi build is slow, env-dependent and runs separately (see `apps/cms/README.md`). |
| `bun run typecheck` | Typecheck every workspace via turbo. |
| `bun run test` | Run the workspace test suites via turbo. |
| `bun run lint` | Lint every workspace via turbo. |
| `bun run format:check` | Check formatting across workspaces. |
| `bun run check:arch` | Run architecture guards for `apps/api`. |
| `bun run doctor:api` | Run the API doctor diagnostics. |
| `bun run commons:check` | Check `@neutra/commons` alignment. |
| `bun run verify:production` | Verify the API production build. |

Web workspace gates (also wired into CI):

| Command | Description |
| --- | --- |
| `bun run --cwd apps/web typecheck` | Typecheck the web workspace. |
| `bun run --cwd apps/web test` | Run the web Vitest suite (includes the error-code drift guard). |
| `bun run --cwd apps/web build` | Build the web app for production. |

## Verification gates

`scripts/verify-layout.mjs` asserts the root layout and that the imported API
history is present; run it with `node scripts/verify-layout.mjs`.

`scripts/verify-dod.mjs` asserts the full phase-1 definition-of-done gate
(single lockfile, no `class-validator`/`class-transformer` in the API,
`@neutra/commons` as `workspace:*`, an isomorphic commons package, the five
migration SHAs, a clean tree and an untouched frontend); run it with
`node scripts/verify-dod.mjs`.

Phase 2 adds three web guards:

- `scripts/verify-web-contracts.mjs` fails if a wire contract (envelope, error
  detail, wire enum or error code) is redefined inside `apps/web/src` instead
  of coming from `@neutra/commons`.
- `scripts/verify-web-ci.mjs` checks that CI runs the web typecheck/test/build
  gates plus the tenant smoke, keeps the Node 22 runtime / bun-only installer,
  preserves the CMS exclusion and respects build ordering.
- `scripts/verify-web-dod.mjs` is the final phase-2 gate: it asserts the web
  history/name, a single lockfile, `workspace:*` contracts, both web guards,
  the reattached drift guard, a clean tree and that the phase-1 gate is still
  7/7. Run it with `node scripts/verify-web-dod.mjs` **after committing** —
  its clean-tree check requires it.

Both final DoD verifiers expect the sibling repos on disk: `verify-dod.mjs`
compares `../neutra-frontend` against `scripts/.frontend-baseline.txt`, and
`verify-web-dod.mjs` re-runs that gate as its last check.

`scripts/verify-debt-remediation.mjs` is the final acceptance gate for the
deferred-debt plan. It asserts all eight remediation criteria: no
`passport-twitter`/`xmldom`, `TENANT_TRUST_HOST_ONLY` wiring (config, middleware
and CI), `CANCELADO` and its idempotent migration, `hold.expired` plus Redis
keyspace notifications, graceful shutdown, `available = stock` defaults with
shared web types, a disk-seeded route manifest and a clean tree. Run it with
`node scripts/verify-debt-remediation.mjs` **after committing** — like the other
final gates, its clean-tree check requires it.

## Web error-code drift guard (reattached in phase 2)

In phase 1 the drift guard at
`neutra-frontend/src/lib/__tests__/error-codes.test.ts` was left untouched and
read the now-stale literal path `../api-neutra-v2/types/error-codes.ts`; the
missing file made it silently skip the check. In phase 2 the front end was
incorporated as `apps/web` and that guard was **reattached to the real source
of truth**: it now imports `ErrorCodes` from `@neutra/commons`, always runs
(no "sibling repo absent" skip path) and contains no `BACKEND_CODES` fallback.
`scripts/verify-web-dod.mjs` asserts both properties. The sibling repositories
`neutra-frontend` and `api-neutra-v2` remain untouched on disk.

## Documented deviations (phase-2 acceptance)

Two conditions are accepted as-is; they are recorded here as deviations, not
failures, and the DoD gate does not try to "fix" them:

1. **`npm.audit` reports WARN in the `ci` doctor profile.** The doctor shells
   out to `bun audit --json`, which carries no `fixAvailable` metadata, so the
   7 advisories (5 moderate, 2 high, 0 critical) are classified as "without a
   non-breaking fix" and the check reports WARN rather than FAIL. This is accepted: the gate still
   blocks on registry/unverifiable failures, no dependency is upgraded, and no
   blocking check is suppressed. The critical `xmldom` advisory was removed in
   the debt-remediation plan; see the final debt status below.
2. **Tenant smoke proves router reachability, not subdomain resolution.** The
   smoke runs against the root host and hits the non-static SSE route
   `/api/revalidate/events` (asserting HTTP 200) plus a separate static
   `/icon.svg` artifact check. It therefore verifies the web router is reachable
   with `x-tenant-slug` / `x-tenant-id` headers, but does **not** exercise
   subdomain-based tenant resolution. This limitation is documented and the
   smoke is left as-is.
3. **CI supplies throwaway `CMS_*` values solely for compose validation.** The
   job `env:` in `.github/workflows/CI.yml` sets `CMS_APP_KEYS`,
   `CMS_API_TOKEN_SALT`, `CMS_ADMIN_JWT_SECRET`, `CMS_JWT_SECRET` and
   `CMS_ENCRYPTION_KEY` to throwaway values because
   `apps/api/docker-compose.prod.yml` declares them with `:?` and the doctor's
   blocking `docker.compose` check validates that file with
   `docker compose config --quiet`. The CMS is excluded from the root build and
   no CMS service is started in CI, so these are placeholder values only — not
   real credentials.
4. **Parity evidence is snapshot consistency, not a byte-for-byte comparison.**
   The `apps/web/tests/parity` fixtures are deterministic mocks: the suite
   checks snapshot consistency against `routes.json` (77 routes), not a real
   Next-vs-Start byte-for-byte comparison. See `apps/web/README.md`.

## Realtime availability — holds are UX-only

The booking storefront acquires a short-lived hold on slot selection and shows
other owners' holds via tenant-scoped SSE. The hold is **not** an authorization
or a reservation guarantee: the API does not validate `holdKey` ownership on
appointment creation and does not release holds itself. The authoritative
protection is the transactional slot lock (HTTP 409 on a lost race); the client
releases its own hold on success or on a 409 and refetches availability. Holds
also expire through Redis TTL. The two `/api/holds` BFF routes keep their source
under `apps/web/src/app/api/holds/**` and their generated form under
`apps/web/src/routes/api/holds/**`; regenerate with
`node apps/web/scripts/generate-api-routes.mjs` instead of editing generated
files by hand.

The SSE feed is UX in the same sense: it is a Host-scoped, tenant-filtered
notification that triggers a scoped query refetch, not an authorization boundary
and not a reservation. A missed event is safe because the client re-fetches;
the authoritative guards remain the transactional appointment slot lock (409 on
a lost race) and the checkout's atomic stock decrement (a failed decrement
rejects the order even if the hold has expired). The web bridge keeps one Redis
subscriber per process, so a multi-replica deployment still relies on sticky
routing plus that refetch; SSE authentication is deliberately unchanged. The
`x-tenant-slug` / `x-tenant-id` headers sent by the smoke and the BFF are
identity hints only — tenant identity is derived from the Host.

The compose `web` service now passes `REDIS_HOST`, `REDIS_PORT` and
`REDIS_PASSWORD` (defaults `redis`, `6379`, empty) to the web server so its
subscriber reaches the compose Redis in dev; without them it falls back to
`localhost:6379` and hold events do not cross the container boundary (boot is
fine — the 30s availability refetch is the safety net).
`scripts/verify-web-ci.mjs` guards against this wiring regressing.

**Restock (D8 — closed in this plan).** Cancelling a `PENDIENTE` order now moves
it to terminal `CANCELADO` and returns each item's `amount` to `Product.stock`
and decrements the coupon's `usageCount` inside the same compare-and-set
transaction, so a double cancellation cannot double-restock. `held` and
`available` are still a UX projection (`available = max(0, stock − active
holds)`), not a committed inventory reservation. Cancellation from
`PAGADO`/`ENVIADO`/`ENTREGADO`, loyalty reversal and refunds remain out of
scope (accepted). `scripts/verify-availability-dod.mjs` records the eight
acceptance checks for the availability cut (including a clean tree, so run it
after committing).

## Debt status after this plan

**Closed in the debt-remediation plan** (design:
`docs/superpowers/specs/2026-11-25-debt-remediation-design.md`):

- **`xmldom` critical** — the unused Twitter OAuth strategy and
  `passport-twitter` were removed; no `xmldom@0.1.31` in the lockfile and no
  critical advisory.
- **Header-based tenant spoofing** — `TENANT_TRUST_HOST_ONLY` adds an optional
  Host-only resolution mode (see below).
- **Restock** — `PENDIENTE → CANCELADO` returns stock and reverts coupon usage
  idempotently in the same transaction.
- **`hold.expired`** — Redis keyspace notifications (`Ex`) plus a dedicated
  subscriber publish real TTL expirations; at-most-once, no replay.
- **Graceful shutdown** — `SIGTERM`/`SIGINT` close the HTTP server, workers
  and queues, and all three Redis clients.
- **Types and stock defaults** — `available = stock` by default; the web
  consumes `IProductResponse` from `@neutra/commons` without local casts.
- **Route generator** — the API route manifest is seeded from disk, so deleting
  a generated route shrinks it.
- **Redis env and SSE comment** — the compose `web` service passes `REDIS_*`
  and the `query-provider.tsx` comment now distinguishes legacy global
  invalidation from typed, scoped availability invalidation.

**Accepted and left out of scope** (recorded, not silently dropped):

- `npm.audit` still reports **WARN for 7 advisories (5 moderate, 2 high,
  0 critical)** in the `ci` doctor
  profile (transitive/exact-pinned; no `fixAvailable`, no safe semver bump).
  Per accepted ruling T6 nothing is upgraded and no blocking check is
  suppressed; this is tracked as separate dependency work.
- Multi-replica SSE: one in-process Redis subscriber per replica, so delivery
  still relies on sticky routing plus the 30s availability refetch.
- SSE authentication is unchanged; the feed is a UX notification, not an
  authorization boundary.
- Refunds, loyalty reversal and cancellation past `PENDIENTE` are not
  implemented.

### `TENANT_TRUST_HOST_ONLY` is production-only

`TENANT_TRUST_HOST_ONLY` defaults to `false`. When set to `true`, tenant
resolution ignores `x-tenant-id` / `x-tenant-slug` and cookies and derives the
tenant solely from the request `Host`. It is intended for **production**
hardening only. It is deliberately **not set in CI**
(`.github/workflows/CI.yml`): the API integration suites authenticate with
`x-tenant-slug` headers by design, and the Host-only mode is covered by the
unit suite instead. See `apps/api/.env.example`.
