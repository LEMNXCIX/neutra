# Debt Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar las deudas triaadas de la feature de disponibilidad: eliminar el critical `xmldom`, reforzar el tenant middleware, añadir cancelación con restock, emitir `hold.expired` y limpiar higiene (shutdown, tipos, generador, config).

**Architecture:** Tres fases en un plan: seguridad (Tasks 1-2), comportamiento (Tasks 3-4) e higiene (Tasks 5-8), con gate final (Task 9) y push/CI autorizado (Task 10). Se conservan las garantías autoritativas existentes (slot lock + decremento atómico) y la independencia de los módulos citas/store.

**Tech Stack:** Node 22 · Express 5 · Prisma 7 + PostgreSQL · Redis 7 (`notify-keyspace-events Ex`) · bun workspaces · Zod en `@neutra/commons`

**Spec:** `docs/superpowers/specs/2026-11-25-debt-remediation-design.md`

## Global Constraints

- Quitar `passport-twitter` (critical `xmldom`); los otros 3 OAuth strategies NO se tocan.
- `TENANT_TRUST_HOST_ONLY` default `false`; cuando `true`, el tenant se resuelve **solo** desde `Host`. Activarlo solo en producción, nunca en CI.
- Restock SOLO `PENDIENTE → CANCELADO`; `CANCELADO` terminal; revierte cupón; SIN lealtad ni reembolsos.
- `hold.expired` vía Redis keyspace notifications `Ex` + subscriber dedicado; at-most-once, sin replay.
- Guards en verde: `check:arch`, R1–R11, `commons:check`, `verify-web-contracts.mjs`, `verify-dod` 7/7, `verify-web-dod` 7/7, `verify-availability-dod` 8/8.
- Sin push salvo autorización; módulos citas/store independientes; framework/runtime sin cambios.

## Review Focus

- **Override de xmldom no aplicado** → tras quitar `passport-twitter`, `bun audit --json` debe dar 0 críticos y 0 advisories de `xmldom`. Test: Task 1 verificación.
- **Header de tenant forjado con Host-only activo** → el tenant resuelto debe ser el del Host. Test: Task 2.
- **Doble cancelación / concurrencia duplicando stock** → el CAS de estado debe hacerla idempotente. Test: Task 3.
- **`hold.expired` con tenant equivocado o clave malformada** → no se publica o se publica al tenant correcto. Test: Task 4.
- **Shutdown dejando conexiones colgantes** → `SIGTERM` cierra servidor, Redis y workers. Test: Task 5.

---

### Task 1: Eliminar Twitter OAuth (critical xmldom)

**Files:**
- Modify: `apps/api/package.json`, `apps/api/middleware/authProvider.middleware.ts`, `apps/api/.env.example`, root `bun.lock`
- Test: verificación de build + audit

**Interfaces:**
- Consumes: nada (primer task).
- Produces: `bun.lock` sin `xmldom@0.1.31`; `useGoogleStrategy`/`useFacebookStrategy`/`useGitHubStrategy` intactos.

- [ ] **Step 1: Verificar el estado actual (falla)**

Run: `grep -n 'xmldom@0.1.31' bun.lock; bun audit --json 2>/dev/null | grep -c xmldom`
Expected: `xmldom@0.1.31` presente y ≥16 advisories de xmldom.

- [ ] **Step 2: Quitar la dependencia y el strategy**

En `apps/api/package.json` eliminar `"passport-twitter"`. En `authProvider.middleware.ts` eliminar el import de `passport-twitter`, la función `useTwitterStrategy` y las claves `twitterConsumerID`/`twitterConsumerSecret` del destructuring de `config`. En `.env.example` eliminar `TWITTER_CONSUMER_ID`/`TWITTER_CONSUMER_SECRET`. No tocar los otros strategies ni `config/index.config.ts` (las claves de config pueden quedar como campos opcionales sin uso).

- [ ] **Step 3: Reinstalar y verificar**

```bash
bun install
grep -c 'xmldom@0.1.31' bun.lock || echo "0"
bun audit --json 2>/dev/null > /tmp/opencode/audit-after.json || true
grep -c '"xmldom"' /tmp/opencode/audit-after.json || echo "0"
bun run --cwd apps/api typecheck
bun run --cwd apps/api test:unit -- auth
```

Expected: 0 `xmldom@0.1.31` en lock, 0 advisories de xmldom, typecheck limpio, tests de auth en verde.

- [ ] **Step 4: Commit**

`git add -A && git commit -m "chore(api): remove unused Twitter OAuth and xmldom critical"`

---

### Task 2: Modo Host-only en tenant middleware

**Files:**
- Modify: `apps/api/config/index.config.ts`, `apps/api/middleware/tenant.middleware.ts`, `apps/api/test/unit/tenant.middleware.test.ts`, `apps/api/.env.example`, `.github/workflows/CI.yml`
- Test: `apps/api/test/unit/tenant.middleware.test.ts`

**Interfaces:**
- Consumes: `resolveTenant` del middleware actual (`tenant.middleware.ts:30-34` con deps `{tenantRepository, environment, logger}`).
- Produces: `config.tenantTrustHostOnly: boolean`; cuando `true`, `x-tenant-id`/`x-tenant-slug` y cookies se ignoran.

- [ ] **Step 1: Escribir el test que falla**

En `tenant.middleware.test.ts`, nuevo describe: con `TENANT_TRUST_HOST_ONLY=true` y `Host: store.ejemplo.com` + headers `x-tenant-slug: superadmin`, asertar que `req.tenant.slug === "store"` (el del Host), no `"superadmin"`. El test existente (`:82-93`, flag off) debe seguir pasando.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun run --cwd apps/api test:unit -- tenant.middleware`
Expected: FAIL (el header gana).

- [ ] **Step 3: Implementar**

En `config/index.config.ts` añadir `tenantTrustHostOnly: process.env.TENANT_TRUST_HOST_ONLY === "true"`. En `tenant.middleware.ts`, al inicio de la resolución: si `config.tenantTrustHostOnly`, saltar los bloques de headers (`:51-55`) y cookies (`:57-72`) y resolver directamente desde `Host` (`:74-85`), manteniendo el fallback de management/development (`:87-94`) y el repository lookup posterior. No cambiar la firma de `deps`.

- [ ] **Step 4: Verificar**

```bash
bun run --cwd apps/api test:unit -- tenant.middleware
bun run --cwd apps/api test:unit
bun run check:arch && bun run doctor:api
```

Expected: tests en verde; guards sin cambios.

- [ ] **Step 5: Documentar (solo producción, NO CI)**

Añadir una línea comentada en `.env.example` con el default `false`, recomendando activar el flag solo en producción. **NO añadir `TENANT_TRUST_HOST_ONLY` al job env de `.github/workflows/CI.yml`**: las suites de integración de la API autentican con `x-tenant-slug` por diseño (test-client.ts) y el modo Host-only ya está cubierto por el test unitario; activarlo en CI rompería el gate sin aportar seguridad. Commit: `git add -A && git commit -m "feat(api): add host-only tenant resolution mode"`

---

### Task 3: Cancelación de orden con restock

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `packages/commons/src/enums/order.ts`, `packages/commons/src/__tests__/enums.test.ts`, `apps/api/core/domain/order/order.policy.ts`, `apps/api/core/application/order/change-order-status.use-case.ts`, `apps/api/infrastructure/database/prisma/order.prisma-repository.ts`, `apps/api/core/application/order/get-order-statuses.use-case.ts`
- Create: migración SQL en `apps/api/prisma/migrations/`
- Test: `apps/api/test/unit/order-cancel-restock.test.ts`

**Interfaces:**
- Consumes: `updateStatus(tenantId, id, data: OrderStatusUpdate)` con CAS `expectedStatus`; `$transaction` existente en `order.prisma-repository.ts:455+`.
- Produces: `CANCELADO` en el enum de Order; `OrderStatusUpdate` sin cambios de firma; el restock ocurre dentro de la misma transacción del CAS.

- [ ] **Step 1: Escribir tests que fallan**

`order-cancel-restock.test.ts`: (a) orden PENDIENTE con 2 items → `updateStatus(PENDIENTE→CANCELADO)` devuelve la orden y el stock de ambos products aumenta en sus `amount`; (b) `usageCount` del cupón se decrementa en 1 si la orden lo usó; (c) orden PAGADO → `canTransitionTo` false (test de policy); (d) dos cancelaciones concurrentes → una devuelve la orden, la otra `null` (CAS) y el stock aumenta una sola vez; (e) `get-order-statuses` incluye `CANCELADO`. En commons, actualizar `enums.test.ts:80` para asertar que `CANCELADO` ahora es válido.

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `bun run --cwd apps/api test:unit -- order-cancel-restock && bun test packages/commons/src/__tests__/enums.test.ts`
Expected: FAIL (`CANCELADO` no existe).

- [ ] **Step 3: Añadir el enum y la transición**

En `schema.prisma:233-238`, `packages/commons/src/enums/order.ts:4-9` y `get-order-statuses.use-case.ts:5-10` añadir `CANCELADO`. En `order.policy.ts:9-14` añadir `PENDIENTE: ["PAGADO", "CANCELADO"]` y `CANCELADO: []`. En `change-order-status.use-case.ts:21-26` añadir `"CANCELADO"` a `validStatuses`. Crear la migración SQL con `ALTER TYPE "OrderStatus" ADD VALUE 'CANCELADO';` (idempotente: usar `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`).

- [ ] **Step 4: Implementar el restock en la transacción**

En `order.prisma-repository.ts:455+`, tras el `updateMany` exitoso y cuando `data.expectedStatus === "PENDIENTE" && data.status === "CANCELADO"`: leer `tx.orderItem.findMany({ where: { orderId: id, tenantId }})` y por cada item `tx.product.updateMany({ where: { id: item.productId, tenantId }, data: { stock: { increment: item.amount }}})`; si la orden tiene `couponId`, `tx.coupon.updateMany` con `usageCount: { decrement: 1 }` guardado por `> 0`. El CAS garantiza idempotencia. No tocar la rama de `ENTREGADO`/lealtad.

- [ ] **Step 5: Verificar**

```bash
bun run --cwd apps/api prisma migrate deploy
bun run --cwd apps/api test:unit -- order-cancel-restock
bun run --cwd apps/api test:unit
bun run --cwd packages/commons test
bun run --cwd apps/api typecheck && bun run check:arch
```

Expected: tests en verde; guards sin cambios.

- [ ] **Step 6: Commit**

`git add -A && git commit -m "feat(order): cancel pending orders with stock restock"`

---

### Task 4: Emitir `hold.expired`

**Files:**
- Modify: `apps/api/docker-compose.yml`, `apps/api/docker-compose.prod.yml`, `packages/commons/src/availability/hold.ts`, `packages/commons/src/availability/index.ts`
- Create: `apps/api/infrastructure/providers/redis-expiry-subscriber.ts`, `apps/api/test/unit/hold-expiry.test.ts`
- Modify: `apps/api/infrastructure/config/runtime.ts`, `apps/api/app.ts` (arranque del subscriber)

**Interfaces:**
- Consumes: `AVAILABILITY_CHANNEL` de `redis-pubsub.provider.ts`, `IEventBus.publish` (Task 4 de la feature previa), `holdKey` de commons.
- Produces: `parseHoldKey(key: string): { resourceType: "appointment"|"product"; tenantId: string; resourceId: string } | null` en commons; `startHoldExpirySubscriber(client, eventBus): Promise<void>` en la API.

- [ ] **Step 1: Escribir el test que falla**

`hold-expiry.test.ts` con Redis de test: (a) configurar el cliente con `configSet("notify-keyspace-events", "Ex")`; (b) adquirir un hold con `holdKey("product","t1","p1")` y TTL 1s; (c) suscribirse con `startHoldExpirySubscriber` a `__keyevent@0__:expired` y asertar que se publica en `neutra:availability` un `HoldEvent` con `type: "hold.expired"`, `tenantId: "t1"`, `resourceKey: "hold:product:t1:p1"`; (d) una clave `basura` no publica nada. Usar un canal de test distinto o limpiar mensajes para no cruzar con otros tests.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun run --cwd apps/api test:unit -- hold-expiry`
Expected: FAIL (`parseHoldKey` y el subscriber no existen).

- [ ] **Step 3: Implementar `parseHoldKey` en commons**

En `hold.ts`, añadir `parseHoldKey` que haga `key.split(":")` y devuelva `null` si no son 4 segmentos o `resourceType` no es `appointment`/`product`. Exportar desde `availability/index.ts`. Test unitario en `packages/commons/src/__tests__/availability.test.ts`.

- [ ] **Step 4: Implementar el subscriber y el arranque**

`redis-expiry-subscriber.ts`: cliente Redis **dedicado** (creado desde `redisOptions`), `configSet("notify-keyspace-events", "Ex")` al arrancar, `subscribe("__keyevent@0__:expired", cb)`, y en el callback `parseHoldKey` → `eventBus.publish({ type: "hold.expired", tenantId, resourceKey: key, expiresAt: new Date().toISOString() })`. Ignorar claves no-`hold:`. En `runtime.ts` crear el cliente y el subscriber; en `app.ts` invocar el arranque después de `app.listen` (fire-and-forget con catch logueado, igual que el bridge del web). Añadir `command: ["redis-server", "--notify-keyspace-events", "Ex"]` al servicio `redis` en ambos compose.

- [ ] **Step 5: Verificar**

```bash
bun run --cwd apps/api test:unit -- hold-expiry
bun test packages/commons/src/__tests__/availability.test.ts
bun run --cwd apps/api typecheck && bun run check:arch && bun run commons:check
```

Expected: tests en verde; guards sin cambios.

- [ ] **Step 6: Commit**

`git add -A && git commit -m "feat(api): emit hold.expired from Redis key expiry"`

---

### Task 5: Shutdown graceful en la API

**Files:**
- Modify: `apps/api/infrastructure/config/runtime.ts`, `apps/api/app.ts`
- Test: `apps/api/test/unit/graceful-shutdown.test.ts`

**Interfaces:**
- Consumes: `app.listen()` handle (actualmente descartado en `app.ts:242`), `RedisProvider.quit()`, `availabilityClient` (Task 4).
- Produces: `runtime.close(): Promise<void>` que cierra Redis (cache + availability), servidor HTTP, workers y queues.

- [ ] **Step 1: Escribir test que falla**

`graceful-shutdown.test.ts`: invocar `runtime.close()` con mocks de clientes/servidor/workers y asertar que se llaman todos los `quit()`/`close()` exactamente una vez. El test falla porque `close` no existe.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun run --cwd apps/api test:unit -- graceful-shutdown`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Exponer `availabilityClient` en el runtime y añadir `close()` que: cierra el servidor guardado (`server.close()`), hace `quit()` de ambos clientes Redis, `close()` de los workers y `close()` de las queues. En `app.ts`, guardar el handle de `listen` y registrar `process.once("SIGTERM"|"SIGINT", () => void runtime.close().finally(() => process.exit(0)))`, con un `setTimeout` de seguridad de 5s que fuerce el exit. No cambiar el comportamiento de request.

- [ ] **Step 4: Verificar**

```bash
bun run --cwd apps/api test:unit -- graceful-shutdown
bun run --cwd apps/api test:unit
bun run check:arch
```

Expected: tests en verde; guard sin cambios.

- [ ] **Step 5: Commit**

`git add -A && git commit -m "fix(api): close redis, server and workers on shutdown"`

---

### Task 6: Default `available = stock` y tipos de commons en el front

**Files:**
- Modify: `apps/api/core/application/dtos/responses/product/product.response.ts`, `apps/web/src/services/products.service.ts`, `apps/web/src/hooks/use-product-availability.ts`
- Test: `apps/web/src/hooks/__tests__/use-product-availability.test.ts`, `apps/api/test/unit/product-availability.test.ts`

**Interfaces:**
- Consumes: `IProductResponse` de `@neutra/commons` con `held?`/`available?` opcionales (dist ya actualizado).
- Produces: `ProductResponse.fromEntity` con `available: product.stock` por defecto; `getById` tipado como `Pick<IProductResponse, "stock"|"held"|"available">`.

- [ ] **Step 1: Escribir tests que fallan**

Test de API: `ProductResponse.fromEntity` sin hold data devuelve `available === product.stock` (no 0). Test de web: eliminar el doble cast — asertar que el hook compila y devuelve `available` del tipo de commons. Run ambos → FAIL.

- [ ] **Step 2: Implementar**

En `product.response.ts:26-32` cambiar el default a `held: 0, available: product.stock`. En `products.service.ts:24-26` tipar `getById` con `Pick<IProductResponse, "stock"|"held"|"available">`. En `use-product-availability.ts` eliminar el tipo local `ProductStock`, el doble cast y el comentario obsoleto; importar el tipo de commons.

- [ ] **Step 3: Verificar**

```bash
bun run --cwd apps/api test:unit -- product-availability
bun run --cwd apps/web test src/hooks/__tests__/use-product-availability.test.ts
bun run --cwd apps/web typecheck && bun run --cwd apps/api typecheck
node scripts/verify-web-contracts.mjs
```

Expected: tests en verde; typechecks limpios; verificador en verde.

- [ ] **Step 4: Commit**

`git add -A && git commit -m "refactor: use commons product types and correct stock defaults"`

---

### Task 7: Generador que reduce el manifest

**Files:**
- Modify: `apps/web/scripts/generate-api-routes.mjs`, `apps/web/src/routes/api/__tests__/route-inventory.test.ts`
- Test: `apps/web/src/routes/api/__tests__/route-inventory.test.ts`

**Interfaces:**
- Consumes: `routeFiles(OUTPUT_API)` existente en el generador; `api-routes.json` con 79 entradas.
- Produces: manifiesto que se regenera desde el disco, sin entradas huérfanas.

- [ ] **Step 1: Escribir test que falla**

En `route-inventory.test.ts`, añadir un test que cree un generated route temporal (o use un fixture) y verifique que, tras `generate`, el manifest NO contiene una entrada eliminada del disco. Alternativamente, asertar que el número de entradas del manifest tras `generate` coincide con `routeFiles(OUTPUT_API)` y que borrar un archivo generado reduce ambas listas. Run → FAIL (el manifest nunca encoge).

- [ ] **Step 2: Implementar**

En `generate-api-routes.mjs:268-273`, reemplazar la siembra desde `api-routes.json` por una enumeración de `routeFiles(OUTPUT_API)` (ruta + métodos ya presentes en cada archivo generado), manteniendo la sobreposición con los sources de `src/app/api`. El manifest resultante debe reflejar altas y bajas. Ajustar el test tautológico (`:70`, `:76`) para comparar contra un conjunto esperado explícito de las 79 rutas, no contra el propio manifest.

- [ ] **Step 3: Verificar**

```bash
cd apps/web && node scripts/generate-api-routes.mjs
bun run --cwd apps/web test src/routes/api/__tests__/route-inventory.test.ts
bun run --cwd apps/web test tests/parity/
node scripts/verify-web-layout.mjs
```

Expected: manifest 79 (o el que corresponda tras el test de borrado), tests en verde, verificador en verde.

- [ ] **Step 4: Commit**

`git add -A && git commit -m "fix(web): shrink route manifest when generated routes are removed"`

---

### Task 8: Config de Redis y comentario SSE en el web

**Files:**
- Modify: `apps/api/docker-compose.yml`, `apps/web/src/providers/query-provider.tsx`, `README.md`
- Test: `node scripts/verify-web-ci.mjs`

**Interfaces:**
- Consumes: defaults de `availability-subscriber.ts` (`localhost:6379`).
- Produces: variables `REDIS_*` pasadas al servicio web en compose; comentario accurate; README actualizado.

- [ ] **Step 1: Verificar que falla**

Run: `node scripts/verify-web-ci.mjs`. Expected: PASS hoy (no cubre Redis), así que añadir una aserción al verificador para que exija `REDIS_HOST`/`REDIS_PORT` en el servicio `web` del compose → FAIL.

- [ ] **Step 2: Implementar**

Añadir al servicio `web` en `apps/api/docker-compose.yml`: `REDIS_HOST: ${REDIS_HOST:-redis}`, `REDIS_PORT: ${REDIS_PORT:-6379}`, `REDIS_PASSWORD: ${REDIS_PASSWORD:-}`. El Compose ya tiene el servicio `redis`. Corregir el comentario en `query-provider.tsx:55` ("solo los mensajes legacy hacen invalidate global; los eventos tipados son scoped"). Actualizar README con el estado final de las deudas cerradas.

- [ ] **Step 3: Verificar**

```bash
node scripts/verify-web-ci.mjs
docker compose -f apps/api/docker-compose.yml config --quiet
bun run --cwd apps/web test
```

Expected: verificador PASS; compose válido; web tests verdes.

- [ ] **Step 4: Commit**

`git add -A && git commit -m "chore: wire Redis env to web and refresh docs"`

---

### Task 9: Gate final de remediación

**Files:**
- Create: `scripts/verify-debt-remediation.mjs`
- Modify: `README.md` (si queda alguna nota pendiente)

**Interfaces:**
- Consumes: Tasks 1-8.
- Produces: verificador reproducible de los criterios del spec de deudas.

- [ ] **Step 1: Escribir el verificador**

`verify-debt-remediation.mjs`: asertar (1) `passport-twitter` ausente de package.json y lock, 0 advisories de xmldom en `bun audit --json`; (2) `TENANT_TRUST_HOST_ONLY` en config y middleware, documentado como producción-only en `.env.example` y ausente del job env de CI; (3) `CANCELADO` en los 3 sitios + migración; (4) `hold.expired` publicado por el subscriber + `notify-keyspace-events Ex` en compose; (5) `runtime.close()` con SIGTERM/SIGINT; (6) `available: product.stock` default y sin `ProductStock` local; (7) generador sin siembra desde manifest; (8) git status limpio.

- [ ] **Step 2: Ejecutar la batería completa**

```bash
bun install --frozen-lockfile
bun run --cwd packages/commons build
bun run typecheck
bun run --cwd apps/api test:unit
bun run --cwd apps/web test
bun run check:arch && bun run commons:check
node scripts/verify-dod.mjs && node scripts/verify-web-dod.mjs && node scripts/verify-availability-dod.mjs && node scripts/verify-debt-remediation.mjs
bun run doctor:api -- --profile ci --include-integration --format text
```

Expected: todo exit 0; API/web tests verdes; cuatro verificadores en verde; doctor con el WARN conocido de npm.audit.

- [ ] **Step 3: Commit final**

`git add -A && git commit -m "chore: verify debt remediation acceptance criteria"`

---

### Task 10: Push y CI (solo con autorización)

- [ ] **Step 1: Confirmar autorización explícita del usuario antes de cualquier push.**
- [ ] **Step 2:** `git push origin main` (sin force), verificar `local == remoto`.
- [ ] **Step 3:** Esperar el run de GitHub Actions en `main` y reportar el resultado. Si falla, investigar y corregir antes de darlo por terminado.
