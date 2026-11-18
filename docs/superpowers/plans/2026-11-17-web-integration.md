# Web Workspace Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar `neutra-frontend` (ya migrado a TanStack Start) como `apps/web` del monorepo, haciendo que consuma todo el contrato de cable desde `@neutra/commons`, y dejar el doctor y CI en verde.

**Architecture:** Approach A: importar el historial con un merge de historiales no relacionados (Approach B, igual que API y CMS), renombrar el workspace a `web`, y adoptar los contratos por capas — primero shims de re-export en `src/types/**` que mantienen estables las 77 Server Routes, luego borrado de los shims sin tipos locales. Los fixes del doctor y CI/Docker van como tasks finales.

**Tech Stack:** bun workspaces + turbo · Node 22 · TanStack Start + Vite 8 + React 19 · Vitest 5 · Zod 4 vía `@neutra/commons` · Strapi 5 (sin cambios)

**Spec:** `docs/superpowers/specs/2026-11-17-web-integration-design.md`

## Global Constraints

- El front consume **todo el contrato de cable** desde `@neutra/commons`: envelope, `ErrorDetail`, 11 familias de códigos, enums y DTOs de request/response. `src/types/**` se convierte en shims y se elimina donde no queden tipos puramente del front.
- Package name `web`; declara `"@neutra/commons": "workspace:*"`. Sin prefijo `0xc1x`.
- Un solo `bun.lock` en el root: eliminar `apps/web/package-lock.json`. `bun install --frozen-lockfile` debe funcionar.
- `@neutra/commons` es isomórfico: 0 imports de `node:*`, `@prisma/client`, `express`, `@/`. Esta fase no puede romperlo.
- Sin cambio de framework/runtime del front: Vite + TanStack + Node 22, puerto 3001, `BACKEND_API_URL`.
- El test de drift importa `ErrorCodes` desde `@neutra/commons`; **sin fallback que omita el check**. Debe fallar si aparece un código sin traducir.
- `error-messages.ts` conserva solo la copia en español keyada por código; los códigos salen de commons.
- Doctor: `node.contract`, `package.lock` y `npm.audit` en verde en perfil `ci`; R1–R11 sin cambios.
- DoD de fase 1 sigue verde: 76 suites / 757 tests de API, `commons:check`, `check:arch`, `verify:production`, `verify-dod.mjs` 7/7.
- No modificar los repos fuente `neutra-frontend` ni `api-neutra-v2`. Sin push salvo autorización explícita.

## Review Focus

- **Drift silencioso repositorio hermano:** el test actual omite el check si `api-neutra-v2/types/error-codes.ts` no existe; tras el move siempre faltaría. → pin: Task 3, test negativo con un código sintético que debe fallar.
- **Dos envelopes divergentes en el front:** `frontend-api.ts` y `backend-api.ts` tienen `metadata?: Record<string, unknown>` y `meta` con index signature, frente a `metadata?: unknown` y `meta` exacto de commons. → pin: Task 2 y Task 4, aserción de que un fixture con `metadata: 42` parsea y de que el tipo inferido no se estrecha.
- **Alias `@/*` tras el move:** `tsconfig.json` y `vitest.config.ts` resuelven `@/` a `./src`; si el move cambia la raíz, 77 rutas dejan de compilar. → pin: Task 1, `typecheck` y `vitest` desde `apps/web`.
- **Rutas del doctor tras el move de CI a la raíz:** `project.adapter.ts` busca `.github/workflows/CI.yml` y `package-lock.json` bajo `context.rootDir` (`apps/api`). → pin: Task 6, test de los tres checks con cwd `apps/api`.
- **Paridad de las 77 Server Routes:** el spec decía 75; el repo tiene 77 y recién salió del cutover. → pin: Task 7, harness de paridad sobre `tests/parity/routes.json` con 77 rutas.

---

### Task 1: Importar el front como `apps/web`

**Files:**
- Move: todo el árbol trackeado de `neutra-frontend` → `apps/web/`
- Modify: `apps/web/package.json` (name `web`), root `bun.lock`
- Create: `scripts/verify-web-layout.mjs`

**Interfaces:**
- Consumes: repo local `../neutra-frontend` (HEAD `75d4d2d`, tag `pre-tanstack-start`).
- Produces: workspace `web` en el monorepo; historial preservado. Los tasks siguientes asumen `apps/web/**`.

- [ ] **Step 1: Escribir el test de layout (falla)**

`scripts/verify-web-layout.mjs`: asertar que `apps/web/package.json` existe con `name === "web"`, que no existe `apps/web/package-lock.json`, que `apps/web/src/routes/api` tiene 77 archivos `route.ts`, y que `git log --format=%H` contiene por prefijo `75d4d2d`, `84fd647`, `26a4a12`, `42406be`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node scripts/verify-web-layout.mjs` (desde la raíz del monorepo)
Expected: FAIL con "no such file".

- [ ] **Step 3: Importar con Approach B**

```bash
cd /mnt/c/Users/leonardo/Repositories/neutra
git remote add web ../neutra-frontend
git fetch web --tags
git merge --allow-unrelated-histories web/main
mkdir apps/web
git ls-files -z | while IFS= read -r -d '' f; do
  case "$f" in
    apps/api/*|apps/cms/*|packages/*|docs/*|scripts/*|package.json|bun.lock|turbo.json|.github/*|.gitignore|.dockerignore|README.md) continue ;;
    *) mkdir -p "$(dirname "apps/web/$f")"; git mv "$f" "apps/web/$f" ;;
  esac
done
```

El filtro excluye SOLO lo que ya pertenece al monorepo; `.github/**`, `.gitignore` y `Dockerfile*` del front se mueven a `apps/web/`. Si un path del front choca con uno existente (p. ej. `.gitignore`), reportar BLOCKED con el path; no resolver por sobrescritura.

- [ ] **Step 4: Renombrar y consolidar lockfile**

Editar `apps/web/package.json`: `"name": "web"`. Borrar `apps/web/package-lock.json`. Ejecutar `bun install` desde la raíz; verificar que `bun.lock` contiene `apps/web` y que `bun install --frozen-lockfile` pasa.

- [ ] **Step 5: Verificar el front importado**

```bash
bun run --cwd apps/web typecheck && bun run --cwd apps/web test
node scripts/verify-web-layout.mjs
```

Expected: typecheck y tests del front en verde (número de tests del repo, ~325); verify-web-layout PASS. Repo source `../neutra-frontend` sin cambios (`git status --short` vacío).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): import TanStack frontend into the monorepo"
```

---

### Task 2: `@neutra/commons` como SSOT en `src/types`

**Files:**
- Modify: `apps/web/package.json`, `apps/web/src/types/**` (13 archivos), `apps/web/tsconfig.json` si hace falta
- Test: `apps/web/tests/commons-types.test.ts`

**Interfaces:**
- Consumes: `@neutra/commons` exports `standardResponseSchema`, `errorDetailSchema`, `responsePaginationSchema`, `ErrorCodes`, `ErrorCode`, `<Name>Schema` y tipos inferidos con nombres de DTO originales.
- Produces: los mismos nombres exportados desde `src/types/**` pero re-exportando de commons; las 77 rutas y los services no cambian de import en este task.

- [ ] **Step 1: Escribir test que falla**

`tests/commons-types.test.ts`: importar de `@/types/frontend-api` y asertar (a) `standardResponseSchema.safeParse` acepta un envelope con `meta: {traceId, timestamp}` y `errors[0].metadata = 42`; (b) el tipo inferido `StandardResponse<{id: string}>` acepta `metadata: 42` en `ErrorDetail` (assert de tipo con `satisfies`); (c) `ErrorCodes.INVALID_CREDENTIALS === "AUTH_INVALID_CREDENTIALS"`; (d) los enums `AppointmentStatus`, `TenantType`, `OrderStatus` y `CategoryType` re-exportados tienen los mismos valores que commons. Antes del cambio, los archivos locales tienen definiciones propias y el test falla en (a) o (b).

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun run --cwd apps/web test tests/commons-types.test.ts`
Expected: FAIL.

- [ ] **Step 3: Agregar la dependencia y convertir a shims**

Agregar `"@neutra/commons": "workspace:*"` a `apps/web/package.json`; `bun install` desde root. Reemplazar las definiciones duplicadas en `src/types/**` por re-exports desde `@neutra/commons`, conservando exactamente los nombres exportados actuales (incluidos aliases como `ApiResponse`, `OrderStatus`). Los archivos `.d.ts` ambient y tipos puramente del front se dejan intactos.

- [ ] **Step 4: Verificar**

```bash
bun run --cwd apps/web test tests/commons-types.test.ts && bun run --cwd apps/web typecheck && bun run --cwd apps/web test
```

Expected: tests PASS; suite completa en verde; 0 cambios en `src/routes/api/**`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor(web): make commons the SSOT for wire types"
```

---

### Task 3: Reatar el test de drift a `@neutra/commons`

**Files:**
- Modify: `apps/web/src/lib/__tests__/error-codes.test.ts`
- Create: `apps/web/src/lib/__tests__/error-coverage.test.ts` (si el helper se extrae)
- Test: ambos archivos

**Interfaces:**
- Consumes: `ErrorCodes` de `@neutra/commons`; `CODE_MESSAGES` / `DOMAIN_MESSAGES` de `@/lib/error-messages`.
- Produces: helper `assertErrorCodeCoverage(codes: string[], translations: Record<string, string>): void` que lanza si falta un código; usado por el test de drift.

- [ ] **Step 1: Escribir tests que fallan**

`error-codes.test.ts`: importar `ErrorCodes` desde `@neutra/commons` (no leer archivos del repo hermano) y asertar que cada `Object.values(ErrorCodes)` tiene traducción en `CODE_MESSAGES` o fallback de dominio. `error-coverage.test.ts`: asertar que `assertErrorCodeCoverage(["AUTH_SYNTHETIC_CODE"], {})` lanza con un mensaje que contiene `AUTH_SYNTHETIC_CODE`.

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `bun run --cwd apps/web test src/lib/__tests__/error-codes.test.ts src/lib/__tests__/error-coverage.test.ts`
Expected: FAIL (helper no existe / import de commons aún no cableado).

- [ ] **Step 3: Implementar**

Extraer `assertErrorCodeCoverage` en `src/lib/__tests__/error-coverage.test.ts` o un helper de test bajo `tests/helpers/`; reescribir `error-codes.test.ts` para importar `ErrorCodes` desde `@neutra/commons` y eliminar `PROJECTS_DIR`/`BACKEND_CODES`/`readPublishedCodes` y el `if (!existsSync(...)) return null`. El guard debe fallar, no omitir.

- [ ] **Step 4: Verificar tests positivo y negativo**

```bash
bun run --cwd apps/web test src/lib/__tests__/error-codes.test.ts src/lib/__tests__/error-coverage.test.ts
```

Expected: ambos PASS; el test negativo demuestra que un código nuevo sin traducir rompe el guard.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test(web): reattach error-code drift guard to commons"
```

---

### Task 4: Envelope y catálogo compartidos en la capa HTTP del front

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/backend-api.ts`, `apps/web/src/lib/api-route-handler.ts`, `apps/web/src/lib/error-messages.ts`
- Test: `apps/web/src/lib/__tests__/envelope-parity.test.ts`

**Interfaces:**
- Consumes: `standardResponseSchema`, `errorDetailSchema`, `ErrorCodes` desde `@neutra/commons`.
- Produces: un único envelope compartido; `ApiError` del front conserva `statusCode`, `errors`, `traceId` y el evento `unauthorized` (spec de TanStack).

- [ ] **Step 1: Escribir test que falla**

`envelope-parity.test.ts`: (a) un fixture de respuesta con `errors[0].metadata = {nested: 1}` y `meta` exacto parsea con `standardResponseSchema` y es aceptado por `ApiError` del front; (b) `backend-api.ts` y `frontend-api.ts` no definen interfaces propias `StandardResponse`/`ErrorDetail` (assert leyendo el source y buscando `interface StandardResponse` / `interface ErrorDetail`); (c) `error-messages.ts` no contiene literales de códigos `AUTH_*` duplicados: los códigos vienen de `ErrorCodes`.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun run --cwd apps/web test src/lib/__tests__/envelope-parity.test.ts`
Expected: FAIL.

- [ ] **Step 3: Unificar envelope y catálogo**

Reemplazar en los tres archivos `lib/` los tipos locales por los de commons, manteniendo la forma en que `api-client.ts` construye `ApiError` y propaga `traceId`. En `error-messages.ts`, sustituir las claves literales de códigos por **claves calculadas** derivadas de `ErrorCodes` (p. ej. `[ErrorCodes.INVALID_CREDENTIALS]: "..."`); el texto en español se queda y el verificador de Task 5 debe seguir encontrando 0 literales `AUTH_*`. No cambiar el cable: status, `errors[]` y `meta.traceId` se reenvían tal cual.

- [ ] **Step 4: Verificar suite completa**

```bash
bun run --cwd apps/web test && bun run --cwd apps/web typecheck
```

Expected: tests en verde; typecheck limpio; paridad de fixtures sin diff (Task 7 la revalida).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor(web): use shared envelope and error catalog in HTTP layer"
```

---

### Task 5: Borrado de shims residuales y verificador de duplicados

**Files:**
- Delete: archivos de `apps/web/src/types/**` que solo re-exportan commons y no tienen tipos locales
- Modify: imports residuales en `src/**` y `tests/**`
- Create: `scripts/verify-web-contracts.mjs`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces: 0 definiciones duplicadas del contrato en `apps/web/src`; verificador ejecutable en CI.

- [ ] **Step 1: Escribir el verificador (falla si hay duplicados)**

`scripts/verify-web-contracts.mjs`: escanear `apps/web/src/**/*.ts|tsx` y fallar si aparece `interface StandardResponse`, `interface ErrorDetail`, `enum AppointmentStatus`, `enum TenantType`, `enum CouponType`, `enum CategoryType`, o un literal de código de error `code: "AUTH_` / `"VALIDATION_` fuera de `error-messages.ts`. Imprimir un PASS con el número de archivos escaneados.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node scripts/verify-web-contracts.mjs`
Expected: FAIL listando los archivos con definiciones duplicadas.

- [ ] **Step 3: Borrar shims y reescribir imports**

Para cada archivo de `src/types/**` que sea solo re-export, borrarlo y reescribir sus imports en `src/**` y `tests/**` para apuntar directamente a `@neutra/commons`. Conservar `react-chartjs-2.d.ts` y cualquier archivo con tipos puramente del front.

- [ ] **Step 4: Verificar**

```bash
bun run --cwd apps/web typecheck && bun run --cwd apps/web test
node /mnt/c/Users/leonardo/Repositories/neutra/scripts/verify-web-contracts.mjs
```

Expected: typecheck y tests en verde; verificador PASS; 0 definiciones duplicadas.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor(web): remove duplicated contract definitions"
```

---

### Task 6: Fixes del doctor (bloqueantes en perfil `ci`)

**Files:**
- Modify: `apps/api/scripts/api-doctor/adapters/project.adapter.ts`, `apps/api/scripts/api-doctor/adapters/audit.adapter.ts`
- Test: `apps/api/test/architecture/doctor-monorepo.test.ts`

**Interfaces:**
- Consumes: root del monorepo con `.github/workflows/CI.yml` y `bun.lock`; cwd del doctor = `apps/api`.
- Produces: `node.contract`, `package.lock` y `npm.audit` en verde en perfil `ci`; `nodeVersionSatisfiesMinimum` con semver `>=`.

- [ ] **Step 1: Escribir test que falla**

`doctor-monorepo.test.ts`: (a) `nodeVersionSatisfiesMinimum("v26.13.1", {major:22,minor:12,patch:0}) === true` y `("v21.0.0", ...) === false`; (b) ejecutar los checks `node.contract`, `package.lock` con `context.rootDir = apps/api` y asertar PASS (resolución de `.github/workflows/CI.yml` y `bun.lock` desde la raíz); (c) el adapter de audit usa `bun audit --json` y no `npm audit` (assert sobre el source).

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun run --cwd apps/api test:unit -- doctor-monorepo`
Expected: FAIL.

- [ ] **Step 3: Implementar los tres fixes**

En `project.adapter.ts`: (1) `nodeVersionSatisfiesMinimum` — si `version.major !== minimum.major`, devolver `version.major > minimum.major`; luego comparar minor y patch como hasta ahora; (2) resolver `.github/workflows/CI.yml` y `bun.lock` desde `resolve(context.rootDir, "..")` (raíz del monorepo) en lugar de `context.rootDir`. En `audit.adapter.ts`: ejecutar `bun audit --json` (flag confirmado en bun 1.4.4), parsear su JSON y preservar la semántica de severidad del check original; si el comando falla, reportar BLOCKED sin relajar el check.

- [ ] **Step 4: Verificar**

```bash
bun run --cwd apps/api test:unit -- doctor-monorepo
bun run doctor:api -- --profile ci --include-integration --format text
```

Expected: test PASS; los tres checks en verde en perfil `ci`; R1–R11 sin cambios.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "fix(doctor): resolve monorepo paths and use bun audit"
```

---

### Task 7: CI, Docker y gates de paridad del front

**Files:**
- Modify: `.github/workflows/CI.yml`, `apps/web/Dockerfile`, `apps/web/Dockerfile.dev`, `apps/api/docker-compose.yml`
- Create: `scripts/verify-web-ci.mjs`
- Test: `tests/parity/**` del front + smoke Docker

**Interfaces:**
- Consumes: workspace `web` (Tasks 1–5), doctor arreglado (Task 6).
- Produces: CI que ejecuta los gates del front sin romper los de la API/CMS; los 77 routes validados contra fixtures.

- [ ] **Step 1: Escribir el verificador de CI (falla)**

`scripts/verify-web-ci.mjs`: asertar que `CI.yml` contiene un step que ejecuta `bun run --cwd apps/web typecheck`, otro con `bun run --cwd apps/web test`, otro con `bun run --cwd apps/web build`, y un smoke con `x-tenant-slug`/`x-tenant-id`; asertar que no aparece `npm ci` ni `cache: bun`; y que el build root sigue excluyendo CMS (`--filter=!neutra-cms`).

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `node scripts/verify-web-ci.mjs`
Expected: FAIL (steps del front ausentes).

- [ ] **Step 3: Implementar CI y Docker**

Agregar los steps del front a `CI.yml` usando la instalación única del root. Ajustar `apps/web/Dockerfile*` para contexto `apps/web` (o raíz con `-f apps/web/Dockerfile`), puerto 3001 y `BACKEND_API_URL`. Agregar el servicio `web` a `apps/api/docker-compose.yml` con el contexto correcto, sin tocar los servicios `api` ni `cms`.

- [ ] **Step 4: Verificar paridad y gates**

```bash
node scripts/verify-web-ci.mjs
bun run --cwd apps/web test tests/parity/
docker compose -f apps/api/docker-compose.yml config --quiet
```

Expected: verificador PASS; paridad de los 77 routes contra `tests/parity/routes.json` sin diff; compose válido.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "ci: add web workspace gates and parity smoke"
```

---

### Task 8: Gate final del DoD de la fase 2

**Files:**
- Create: `scripts/verify-web-dod.mjs`
- Modify: `README.md` (documentar el workspace `web` y el drift guard reapuntado)

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: verificación reproducible de todos los criterios del spec de fase 2.

- [ ] **Step 1: Escribir el verificador**

`scripts/verify-web-dod.mjs`: asertar (1) `apps/web` con historial (`75d4d2d`) y `name: web`; (2) un solo `bun.lock` y sin `package-lock.json`; (3) `@neutra/commons: workspace:*` en `apps/web`; (4) `verify-web-contracts.mjs` y `verify-web-ci.mjs` PASAn; (5) drift test importa `ErrorCodes` desde commons y no contiene `BACKEND_CODES`; (6) `git status` limpio; (7) `verify-dod.mjs` de fase 1 sigue 7/7.

- [ ] **Step 2: Ejecutar la batería**

```bash
bun install --frozen-lockfile
bun run --cwd apps/web typecheck && bun run --cwd apps/web test && bun run --cwd apps/web build
bun run typecheck && bun run --cwd apps/api test:unit
bun run check:arch && bun run commons:check && bun run --cwd apps/api verify:production
bun run doctor:api -- --profile ci --include-integration --format text
node scripts/verify-dod.mjs && node scripts/verify-web-dod.mjs
```

Expected: todo exit 0; API 76/757; front tests en verde; doctor sin checks bloqueantes fallidos; ambos verificadores PASS.

- [ ] **Step 3: Commit final**

```bash
git add -A && git commit -m "chore: verify web integration acceptance criteria"
```
