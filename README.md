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
   23 real advisories (13 high, 1 critical) are classified as "without a
   non-breaking fix" and the check reports WARN rather than FAIL. This is
   accepted: the gate still blocks on registry/unverifiable failures, no
   dependency is upgraded, and no blocking check is suppressed.
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

## Follow-ups

- **Security debt (accepted WARN, not remediated here).** `npm.audit` in the
  `ci` doctor profile reports **23 advisories (1 critical, 13 high)**. Per
  accepted ruling T6 it stays WARN: no dependency is upgraded and no blocking
  check is suppressed. Dependency remediation is a separate, tracked task —
  recorded here so the WARN does not become invisible debt.
