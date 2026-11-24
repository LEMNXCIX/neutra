# Real-time Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evitar la doble reserva de citas con una garantía transaccional y mostrar disponibilidad en tiempo real en citas e inventario mediante holds con TTL y eventos SSE, sin acoplar los dos módulos.

**Architecture:** Approach A del spec: un `HoldProvider` genérico en Redis y un bus Redis pub/sub compartidos como infraestructura; la corrección se implementa por módulo (lock transaccional en citas, decremento atómico ya existente en stock). El web reutiliza su SSE tenant-scoped como canal de UX, con invalidación por query key.

**Tech Stack:** Node 22 · Express 5 · Prisma 7 + PostgreSQL (`pg_advisory_xact_lock`) · Redis (TTL + pub/sub) · BullMQ existente · TanStack Start + TanStack Query · Zod en `@neutra/commons`

**Spec:** `docs/superpowers/specs/2026-11-24-realtime-availability-design.md`

## Global Constraints

- Módulos **independientes**: comparten infraestructura (holds + bus), no dominio ni datos. Sin integración store↔booking.
- Corrección de citas: lock transaccional `pg_advisory_xact_lock` por `(tenantId, staffId, día)` + re-check de solapamiento **dentro** de la transacción.
- Stock visible = `stock` DB − **holds activos**; el checkout atómico actual (`stock: { gte: amount }` en `$transaction`) sigue siendo la garantía final.
- Sin `restock` en este corte (deuda documentada).
- Identidad del tenant solo desde `Host` (`tenant-request.ts:182-187`); nunca confiar en `x-tenant-*` del cliente.
- `ownerId` derivado en el servidor (cookie), nunca del body.
- SSE es optimización: el cliente debe re-fetch de seguridad aunque no llegue ningún evento.
- Guards existentes en verde: `check:arch`, R1–R11, `commons:check`, `verify-web-contracts.mjs`, `verify-dod.mjs` 7/7, `verify-web-dod.mjs` 7/7.
- Sin cambio de framework/runtime. Sin push salvo autorización explícita.

## Review Focus

- **Dos usuarios confirman el mismo slot simultáneamente** → exactamente uno 201 y el otro 409. Test: Task 2, `Promise.allSettled` de dos creates concurrentes.
- **Hold expirado antes de confirmar** → el slot/producto vuelve a estar disponible y la API sigue protegida. Tests: Task 3 (TTL) y Task 9 (checkout con hold stale → 422).
- **Stock visible con holds de dos compradores** → `available = stock − holds`, sin contar expirados. Test: Task 7.
- **Evento SSE cruzando tenants** → otro tenant no debe recibirlo. Test: Task 5 (ampliar `server-entry.test.ts:234-261`).
- **Pérdida del bridge SSE** → la vista se refresca por re-fetch periódico; el contrato sigue correcto. Test: Task 6 y Task 8 (sin EventSource / evento no entregado, la query se invalida por fallback).

---

### Task 1: Contratos compartidos para holds y eventos

**Files:**
- Create: `packages/commons/src/availability/hold.ts`, `packages/commons/src/availability/events.ts`, `packages/commons/src/availability/index.ts`
- Modify: `packages/commons/src/index.ts`
- Test: `packages/commons/src/__tests__/availability.test.ts`

**Interfaces:**
- Consumes: Zod 4, patrón de schemas en `packages/commons/src/booking/schemas/`.
- Produces:
  - `holdKey(resourceType: "appointment" | "product", tenantId: string, resourceId: string): string` → `hold:<resourceType>:<tenantId>:<resourceId>`
  - `HoldEvent` = `{ type: "hold.acquired" | "hold.released" | "hold.expired" | "appointment.created" | "stock.changed"; tenantId: string; resourceKey: string; expiresAt?: string }`
  - `AcquireHoldRequestSchema` (Zod) = `{ resourceType, tenantId, resourceId, ttlSeconds?: number }` con `ttlSeconds` entero positivo y máximo 600
  - `AvailableStock` = `{ productId: string; stock: number; held: number; available: number }`

- [ ] **Step 1: Escribir el test que falla**

`availability.test.ts`: (a) `holdKey("appointment","t1","s1") === "hold:appointment:t1:s1"`; (b) `AcquireHoldRequestSchema.parse` acepta `{resourceType:"product",tenantId:"t1",resourceId:"p1"}` y rechaza `ttlSeconds: 0` y `ttlSeconds: 601`; (c) un `HoldEvent` con `type: "hold.expired"` parsea con `expiresAt` opcional.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun test packages/commons/src/__tests__/availability.test.ts`
Expected: FAIL con "Cannot find module '../availability'".

- [ ] **Step 3: Implementar schemas y helper**

Crear los tres archivos, exportar desde `src/availability/index.ts` y desde el barrel root. `holdKey` es una función pura sin dependencias (isomórfica).

- [ ] **Step 4: Verificar**

Run: `bun test packages/commons/src/__tests__/availability.test.ts && bun run --cwd packages/commons build && node scripts/verify-dod.mjs`
Expected: test PASS, build emite dist, DoD 7/7.

- [ ] **Step 5: Commit**

`git add packages/commons && git commit -m "feat(commons): add hold and availability event contracts"`

---

### Task 2: Corrección transaccional de doble reserva en citas

**Files:**
- Modify: `apps/api/core/repositories/appointment.repository.interface.ts`, `apps/api/infrastructure/database/prisma/appointment.prisma-repository.ts`, `apps/api/core/application/booking/create-appointment.use-case.ts`
- Test: `apps/api/test/unit/appointment-slot-lock.test.ts`

**Interfaces:**
- Consumes: `checkAvailability` y `create` actuales (firmas en `appointment.repository.interface.ts:120-126` y `:71`).
- Produces:
  - `withSlotLock<T>(tenantId: string, staffId: string, startTime: Date, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>`
  - `checkAvailability(..., tx?: Prisma.TransactionClient)` y `create(..., tx?: Prisma.TransactionClient)` — parámetro opcional al final, sin cambiar los callers existentes.
  - El conflicto sigue siendo `InvalidStateError("The selected time slot is already booked")` → HTTP 409 (`RESOURCE_INVALID_STATE`).

- [ ] **Step 1: Escribir el test que falla**

`appointment-slot-lock.test.ts`: con la BD de test, lanzar `Promise.allSettled` de dos `create` concurrentes para el mismo `(tenantId, staffId, startTime)`; asertar exactamente un `fulfilled` y un `rejected` con código `RESOURCE_INVALID_STATE`, y que `findAll` devuelve **una sola** cita activa. El test debe fallar antes del lock.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun run --cwd apps/api test:unit -- appointment-slot-lock`
Expected: FAIL (ambas creates pasan, 2 citas).

- [ ] **Step 3: Implementar el lock y el re-check**

`withSlotLock` abre `prisma.$transaction`, ejecuta `SELECT pg_advisory_xact_lock(hashtext($1))` con clave `` `${tenantId}|${staffId}|${startTime.toISOString().slice(0,10)}` `` y llama a `fn(tx)`. En el use case, envolver el `checkAvailability` existente (`:137-142`) y el `create` (`:190-193`) dentro de `withSlotLock`, pasando `tx`. Si `tx` está presente, la rama de cupón reutiliza `tx` en vez de abrir un `$transaction` anidado. No cambiar la lógica de cupones ni la de working hours.

- [ ] **Step 4: Verificar**

```bash
bun run --cwd apps/api test:unit -- appointment-slot-lock
bun run --cwd apps/api test:unit
bun run check:arch && bun run doctor:api
```

Expected: test de concurrencia PASS; suite unitaria verde; guards sin cambios.

- [ ] **Step 5: Commit**

`git add apps/api && git commit -m "fix(booking): serialize slot creation with advisory lock"`

---

### Task 3: HoldProvider genérico en Redis

**Files:**
- Create: `apps/api/core/providers/hold-provider.interface.ts`, `apps/api/infrastructure/providers/redis-hold.provider.ts`
- Test: `apps/api/test/unit/redis-hold.provider.test.ts`

**Interfaces:**
- Consumes: `holdKey` de Task 1; `RedisProvider`/`redisOptions` existentes.
- Produces:
  - `IHoldProvider.acquire(key: string, ownerId: string, ttlSeconds: number): Promise<{ key: string; expiresAt: Date }>`
  - `IHoldProvider.release(key: string, ownerId: string): Promise<boolean>` — devuelve false si no existe o el owner no coincide (no-op silencioso).
  - `IHoldProvider.countActive(keys: string[]): Promise<Record<string, number>>` — devuelve 0 para claves inexistentes/expiradas.

- [ ] **Step 1: Escribir tests que fallan**

`redis-hold.provider.test.ts`: (a) `acquire("k","o1",2)` → `expiresAt` ~2s futura; (b) `countActive(["k"])` → 1; (c) `release("k","o2")` → false y el hold sigue; (d) `release("k","o1")` → true y `countActive` → 0; (e) tras `ttlSeconds: 1` y espera, `countActive` → 0.

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `bun run --cwd apps/api test:unit -- redis-hold`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Usar Redis `SET key ownerId EX ttlSeconds NX` en `acquire`; `GET` + comparación de owner y `DEL` en `release`; `MGET` en `countActive`. El valor guardado es `ownerId`, suficiente para pertenencia; TTL nativo evita job de limpieza. Sin lógica de dominio.

- [ ] **Step 4: Verificar**

Run: `bun run --cwd apps/api test:unit -- redis-hold && bun run --cwd apps/api typecheck`
Expected: PASS; typecheck limpio.

- [ ] **Step 5: Commit**

`git add apps/api && git commit -m "feat(api): add generic Redis hold provider"`

---

### Task 4: Bus de eventos, rutas de holds y composición

**Files:**
- Create: `apps/api/core/providers/event-bus.interface.ts`, `apps/api/infrastructure/providers/redis-pubsub.provider.ts`, `apps/api/infrastructure/routes/holds.routes.ts`, `apps/api/interface-adapters/controllers/holds.controller.ts`, `apps/api/core/application/availability/acquire-hold.use-case.ts`, `apps/api/core/application/availability/release-hold.use-case.ts`, `apps/api/middleware/hold-owner.middleware.ts`
- Modify: `apps/api/infrastructure/config/runtime.ts`, `apps/api/infrastructure/config/http-controllers/index.ts` (o equivalente), `apps/api/app.ts`

**Interfaces:**
- Consumes: `IHoldProvider` (Task 3), `HoldEvent`/`AcquireHoldRequestSchema` (Task 1), patrón de factories `createBookingControllers`/`cart(app, controller, authenticate)`.
- Produces:
  - `IEventBus.publish(event: HoldEvent): Promise<void>` — canal Redis `neutra:availability`.
  - `POST /api/holds` → 201 con `{ key, expiresAt }`; `DELETE /api/holds/:key` → 204/200 con `{ released: boolean }`.
  - `holdOwner(req, res, next)` middleware: lee cookie `hold_owner`; si falta, genera UUID con `NodeCryptoProvider` y la guarda con `httpOnly`, `sameSite: "lax"`, 7 días. Expone `req.holdOwnerId`.

- [ ] **Step 1: Escribir test que falla**

`apps/api/test/unit/holds-routes.test.ts`: con supertest, `POST /api/holds` con body válido sin cookie → 201 y `Set-Cookie: hold_owner=...`; segundo POST con la misma cookie para otra clave; `DELETE` de la primera con distinta cookie → no libera (released false); con la correcta → released true. Mock del bus para asertar un `hold.acquired` publicado.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun run --cwd apps/api test:unit -- holds-routes`
Expected: FAIL (ruta no existe).

- [ ] **Step 3: Implementar y cablear**

Publicar el evento después de adquirir/liberar con `expiresAt` en ISO. Registrar `hold` y `eventBus` en `runtime.providers`, crear los use cases y el controller en la factory de controladores HTTP, montar `holds(app, controllers.holds)` en `app.ts` **después** de `tenantMiddleware` (para tener `tenantId` derivado del Host). El `tenantId` del body debe ignorarse; usar `tenantIdOf(req)`.

- [ ] **Step 4: Verificar**

```bash
bun run --cwd apps/api test:unit -- holds-routes
bun run --cwd apps/api test:unit
bun run check:arch && bun run doctor:api
```

Expected: tests en verde; ninguna regla R1–R11 tocada.

- [ ] **Step 5: Commit**

`git add apps/api && git commit -m "feat(api): expose hold routes and availability event bus"`

---

### Task 5: Bridge SSE tipado en el web

**Files:**
- Modify: `apps/web/src/server.ts`, `apps/web/src/lib/content-cache.ts`, `apps/web/src/providers/query-provider.tsx`
- Test: `apps/web/src/__tests__/server-entry.test.ts` (ampliar), `apps/web/src/lib/__tests__/availability-sse.test.ts`

**Interfaces:**
- Consumes: `HoldEvent` de Task 1; listeners de `content-cache.ts`; `EventSource` en `query-provider.tsx`.
- Produces: eventos SSE con `data: <JSON del HoldEvent>`, manteniendo el mensaje legacy `content:<tenantId>` para Strapi; filtro `event.tenantId === tenantTag` (el tag se deriva del Host). Suscripción Redis en el proceso del web al canal `neutra:availability`.

- [ ] **Step 1: Escribir tests que fallan**

Ampliar `server-entry.test.ts`: (a) un `HoldEvent` del tenant correcto llega al cliente con su `type` y `resourceKey`; (b) un evento de otro tenant NO llega (test existente `:234-261`); (c) el mensaje legacy de Strapi sigue llegando. En `availability-sse.test.ts`: el listener genérico recibe el evento y el `QueryClient` invalida solo la key `["availability", resourceType, tenantId]`.

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `bun run --cwd apps/web test src/__tests__/server-entry.test.ts src/lib/__tests__/availability-sse.test.ts`
Expected: FAIL (payload sigue siendo un tag suelto).

- [ ] **Step 3: Implementar**

Extraer el registro de listeners de `content-cache.ts` a un helper genérico `createTenantEventHub()` (mantener `onContentRevalidated` como wrapper). En `server.ts`, suscribirse al canal Redis y re-emitir cada evento por el stream filtrando por tenant; inicializar la suscripción una sola vez. En `query-provider.tsx`, parsear el JSON y llamar `invalidateQueries({ queryKey: ["availability", ...] })`, con `invalidateQueries()` global solo para el mensaje legacy de Strapi.

- [ ] **Step 4: Verificar**

```bash
bun run --cwd apps/web test src/__tests__/server-entry.test.ts src/lib/__tests__/availability-sse.test.ts
bun run --cwd apps/web test tests/parity/
node scripts/verify-web-ci.mjs
```

Expected: tests PASS; paridad 77 routes sin diff; verificador en verde.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "feat(web): bridge availability events into tenant SSE"`

---

### Task 6: Storefront de citas con hold y disponibilidad reactiva

**Files:**
- Modify: `apps/web/src/components/booking/booking-wizard.tsx`, `apps/web/src/services/booking.service.ts`
- Create: `apps/web/src/hooks/use-availability.ts`
- Test: `apps/web/src/components/booking/__tests__/booking-wizard-hold.test.tsx`

**Interfaces:**
- Consumes: `GET /api/appointments/availability`, `POST /api/holds`, `DELETE /api/holds/:key` (Tasks 2 y 4), eventos SSE (Task 5).
- Produces: `useAvailability({staffId, serviceId, date})` con query key `["availability","appointment",tenantId,staffId,serviceId,date]`; el wizard muestra un slot como `held-by-other` cuando llega `hold.acquired` y lo deshabilita; al confirmar, envía el `holdKey` junto al body de creación (el API valida pertenencia en Task 2/4).

- [ ] **Step 1: Escribir test que falla**

`booking-wizard-hold.test.tsx`: (a) al hacer click en un slot se llama a `POST /api/holds` con `resourceType: "appointment"` y el slot queda en estado `mine`; (b) al recibir `hold.acquired` para el mismo slot con otro owner, el botón se deshabilita y muestra "alguien está reservando"; (c) al recibir `hold.expired`, vuelve a estar habilitado; (d) si `createAppointment` devuelve 409, se libera el hold y se recarga la query.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun run --cwd apps/web test src/components/booking/__tests__/booking-wizard-hold.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Crear el hook con `useQuery` (staleTime 0 para disponibilidad) y suscribirse a los eventos ya conectados en Task 5. En el wizard, reemplazar el fetch único (`booking-wizard.tsx:823-847`) por el hook, añadir el estado `held-by-other` a los botones (`:468-495`) y agregar el `holdKey` al submit (`:880-936`). No tocar el cálculo de slots ni el calendario.

- [ ] **Step 4: Verificar**

```bash
bun run --cwd apps/web test src/components/booking/__tests__/booking-wizard-hold.test.tsx
bun run --cwd apps/web test
bun run --cwd apps/web typecheck
```

Expected: tests en verde (505 + nuevos), typecheck limpio.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "feat(web): hold appointment slots in booking wizard"`

---

### Task 7: Disponibilidad de productos con holds en la API

**Files:**
- Modify: `apps/api/core/application/dtos/responses/product/product.response.ts`, `apps/api/core/application/products/get-all-products.use-case.ts`, `apps/api/core/application/products/get-product.use-case.ts`, `apps/api/infrastructure/config/http-controllers/commerce.controllers.ts`
- Test: `apps/api/test/unit/product-availability.test.ts`

**Interfaces:**
- Consumes: `IHoldProvider.countActive(keys)` (Task 3), `holdKey("product", tenantId, productId)` (Task 1), `IProductResponse.stock`.
- Produces: `IProductResponse` añade `held: number` y `available: number`; `available = Math.max(0, stock - held)`. Listados calculan los holds en **una sola llamada** `countActive(keys)`.

- [ ] **Step 1: Escribir test que falla**

`product-availability.test.ts`: dos products con stock 5; un hold activo sobre p1 y dos sobre p2 (simulados con el provider); `GetAllProductsUseCase` devuelve p1 `{stock:5,held:1,available:4}` y p2 `{stock:5,held:2,available:3}`; un hold expirado no cuenta.

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `bun run --cwd apps/api test:unit -- product-availability`
Expected: FAIL (campos ausentes).

- [ ] **Step 3: Implementar**

Inyectar `IHoldProvider` en ambos use cases vía la factory de controladores/runtime; en `ProductResponse.fromEntity` añadir los campos con valores por defecto 0 para no romper otros callers, y pasarlos explícitamente desde los use cases. Usar `tenantId` del repositorio/relación del producto, nunca del body.

- [ ] **Step 4: Verificar**

```bash
bun run --cwd apps/api test:unit -- product-availability
bun run --cwd apps/api test:unit
bun run --cwd apps/api typecheck
```

Expected: PASS; suite verde; typecheck limpio.

- [ ] **Step 5: Commit**

`git add apps/api && git commit -m "feat(api): expose product availability with active holds"`

---

### Task 8: Tienda con hold de stock y checkout atómico

**Files:**
- Modify: `apps/web/src/types/cart.types.ts` (o el tipo de producto usado), `apps/web/src/store/tanstack/cart-store.ts`, `apps/web/src/components/product-grid.tsx`, `apps/web/src/components/product-detail-client.tsx`, `apps/web/src/services/cart.service.ts`
- Create: `apps/web/src/hooks/use-product-availability.ts`
- Test: `apps/web/src/components/__tests__/product-hold.test.tsx`

**Interfaces:**
- Consumes: `IProductResponse` con `available` (Task 7), `POST /api/holds`/`DELETE` (Task 4), eventos SSE (Task 5), `cartService.addItem`.
- Produces: el botón "Agregar" se deshabilita cuando `available <= 0` o cuando hay hold ajeno; al agregar se adquiere un hold `product` y se libera al quitar del carrito o al completar checkout. El checkout sigue llamando a `POST /api/order` (decremento atómico existente).

- [ ] **Step 1: Escribir test que falla**

`product-hold.test.tsx`: (a) producto con `available: 0` → botón deshabilitado; (b) click con `available: 1` → `POST /api/holds` con `resourceType:"product"` antes de `addItem`; (c) evento `hold.acquired` ajeno sobre el mismo producto → botón deshabilitado con texto "lo está agregando otro usuario"; (d) `hold.expired` → habilitado; (e) checkout con 422 `BUSINESS_INSUFFICIENT_STOCK` → mensaje existente y recarga de disponibilidad.

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `bun run --cwd apps/web test src/components/__tests__/product-hold.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Crear `useProductAvailability` con query key `["availability","product",tenantId,productId]` e invalidación por evento. En `product-grid.tsx` y `product-detail-client.tsx` usar `available` en vez de `stock` para el estado del botón. En `cart-store.ts`, adquirir/liberar el hold alrededor de `addItem`/`removeItem`; tras crear la orden, liberar los holds del usuario. No cambiar el checkout atómico ni el cálculo de totales.

- [ ] **Step 4: Verificar**

```bash
bun run --cwd apps/web test src/components/__tests__/product-hold.test.tsx
bun run --cwd apps/web test
bun run --cwd apps/web typecheck
```

Expected: tests en verde; typecheck limpio.

- [ ] **Step 5: Commit**

`git add apps/web && git commit -m "feat(web): hold product stock in the store"`

---

### Task 9: Gate final, guards y CI

**Files:**
- Create: `scripts/verify-availability-dod.mjs`
- Modify: `README.md` (documentar deuda de restock y que SSE es UX)

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces: verificador reproducible de los criterios del spec.

- [ ] **Step 1: Escribir el verificador**

`verify-availability-dod.mjs`: asertar (1) `holdKey` y `HoldEvent` exportados por commons; (2) `withSlotLock` presente en el repositorio de citas y usado por el create; (3) `IHoldProvider` con TTL y `countActive`; (4) `POST/DELETE /api/holds` montadas; (5) bridge SSE con filtro por tenant; (6) `IProductResponse` con `held`/`available`; (7) 0 literales `x-tenant-slug` en los nuevos archivos de API; (8) `git status` limpio.

- [ ] **Step 2: Ejecutar la batería**

```bash
bun install --frozen-lockfile
bun run --cwd packages/commons build
bun run typecheck
bun run --cwd apps/api test:unit
bun run --cwd apps/web test
bun run check:arch && bun run commons:check && bun run --cwd apps/api doctor -- --profile ci --include-integration --format text
node scripts/verify-dod.mjs && node scripts/verify-web-dod.mjs && node scripts/verify-availability-dod.mjs
```

Expected: todo exit 0; API 77/762 + nuevos tests; web 505 + nuevos; DoD 7/7 en ambos verificadores.

- [ ] **Step 3: Commit final**

`git add -A && git commit -m "chore: verify real-time availability acceptance criteria"`
