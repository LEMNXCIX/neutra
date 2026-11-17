# Neutra CMS (`apps/cms`)

Strapi 5 application imported from the sibling `neutra-cms` repository. Its full
git history (`5678693` and ancestors) is part of this monorepo's history.

The workspace is identified by its **folder** (`apps/cms`). The `name` field in
`package.json` intentionally stays `"neutra-cms"`.

## Build

Strapi has its own build pipeline and does not go through the root turbo graph:

```bash
bun install                    # from the monorepo root
bun run --cwd apps/cms build   # runs `strapi build`
bun run --cwd apps/cms dev     # runs `strapi develop`
```

## Dependency state

This import preserves the **in-flight, previously uncommitted dependency
upgrade** from the source working tree:

- `@strapi/strapi` / `@strapi/database`: `5.52.1` → `^5.57.0`
- `typescript`: `^5` → `^7.0.2`
- (plus `pg`, `styled-components` and `@types/node` bumps from the same diff)

The legacy `package-lock.json` has been removed in favour of the single root
`bun.lock`, per the monorepo single-lockfile rule.

## Docker

A `cms` service using `apps/cms/Dockerfile` is defined in
`apps/api/docker-compose.yml` and `apps/api/docker-compose.prod.yml`. The CMS
needs Strapi's secrets (`APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`,
`JWT_SECRET`, `ENCRYPTION_KEY`); in production these are required environment
variables and have no defaults.
