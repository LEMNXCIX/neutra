# neutra

Monorepo for the Neutra multi-tenant commerce and booking platform. Bun
workspaces (`apps/*`, `packages/*`) orchestrated with turbo; a single `bun.lock`
lives at the root.

## Layout

- `apps/api/` — multi-tenant Express/TypeScript API (imported from
  `api-neutra-v2`, full git history preserved).
- `apps/cms/` — Strapi CMS (imported from `neutra-cms`, full git history preserved).
- `packages/commons/` — `@neutra/commons`, the single source of truth for
  wire contracts shared between the API and the CMS.

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

`scripts/verify-layout.mjs` asserts the root layout and that the imported API
history is present; run it with `node scripts/verify-layout.mjs`.
`scripts/verify-dod.mjs` asserts the full definition-of-done gate (single
lockfile, no `class-validator`/`class-transformer` in the API, `@neutra/commons`
as `workspace:*`, an isomorphic commons package, the five migration SHAs, a
clean tree and an untouched frontend); run it with `node scripts/verify-dod.mjs`.

## Known degradation: frontend error-code drift guard

The drift guard in `neutra-frontend/src/lib/__tests__/error-codes.test.ts` was
**not modified** by this migration — the `neutra-frontend` repository itself is
left untouched (`scripts/.frontend-baseline.txt` is the unchanged baseline
verified by `scripts/verify-dod.mjs`). It therefore **still reads** the literal
path `../api-neutra-v2/types/error-codes.ts`. That path is now **stale**: the API
was moved into `apps/api` in this monorepo, so the old sibling-repo file no
longer resolves, while the authoritative wire error codes now live in
`@neutra/commons` here. The test detects the missing file and silently skips the
drift check (it does not fail), so the guard is **blind until phase 2**, when
`neutra-frontend` is incorporated as `apps/web` and the test is repointed at
`@neutra/commons`.
