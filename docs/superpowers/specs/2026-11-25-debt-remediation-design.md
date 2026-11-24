# Remediación de deudas — Design Spec

- **Fecha:** 2026-11-25
- **Estado:** propuesto (pendiente de revisión del usuario y de `writing-plans`)
- **Alcance:** diseño únicamente. Ninguna decisión de esta sesión modifica código de producción.
- **Antecedentes:** spec de disponibilidad `2026-11-24-realtime-availability-design.md` y su plan; feature implementada en `8f1cd2d` + fix wave en `8f1cd2d` (rama local 17→19 commits ahead de `origin/main`).

## 1. Contexto y triaje

Se triaron con evidencia las deudas documentadas al cierre de la feature de disponibilidad. Resultado:

| ID | Deuda | Evidencia clave | Incluida |
| --- | --- | --- | --- |
| A | `xmldom@0.1.31` (critical) sigue en `bun.lock:3721` | `passport-twitter@1.0.4` → `xtraverse` → `xmldom`. Override en `apps/api/package.json:105` no lo aplica bun (solo lee overrides del root). `useTwitterStrategy` tiene **cero llamadores**. | SÍ — quitar `passport-twitter` |
| B | `x-tenant-*` confiado en `tenant.middleware.ts:51-55` | Rutas sin autenticar (holds, `security: []`) permiten elegir tenant por header. El BFF lo sobrescribe en producción, pero la API expuesta directamente es vulnerable. Las rutas autenticadas ya validan membresía (`resolve-authenticated-user.use-case.ts:100-126`). | SÍ — modo Host-only configurable |
| C | Sin `CANCELADO` ni restock de órdenes | `OrderStatus` 4 valores en 3 sitios; stock se descuenta al crear (`order.prisma-repository.ts:231-243`). No existe flujo de cancelación. | SÍ — solo `PENDIENTE → CANCELADO` |
| D | `hold.expired` nunca se emite | `notify-keyspace-events` desactivado en `redis:7-alpine`; el valor del hold solo guarda `ownerId` (sin tenant). La UI tiene re-fetch de 30 s como red. | SÍ — emitir vía TTL notification |
| E | Segundo cliente Redis sin `quit()` | `runtime.ts:87-98` no expone el cliente; `app.ts` no tiene `SIGTERM`/`SIGINT`. | SÍ — shutdown hook |
| F | `available: 0` en create/update/search | `product.response.ts:26-32` default 0; `productsService.search` sin uso en UI de compra. | SÍ — default a `stock` |
| G | Commons dist / tipo local `ProductStock` | El dist **ya está actualizado** (`held`/`available` opcionales). El cast viene de la entidad `Product`, no del dist. Comentario en `use-product-availability.ts:12-16` obsoleto. | SÍ — limpieza de tipos/comentario |
| H | Generador no reduce el manifest | `generate-api-routes.mjs:264-273` siembra desde el manifest (79) y nunca borra entradas; solo 4 sources reales. | SÍ — sembrar desde disco |
| I | Comentario obsoleto en `query-provider.tsx:55`; `REDIS_*` ausente en compose web | El SSE degrada sin REDIS_* (re-fetch de red). | SÍ — documentación/config |

**Fuera de alcance** (triado como ruido o decisión anterior): WARN de `npm.audit` por los 7 advisories restantes — todos transitivos o exact-pinned (`effect` vía Prisma, `react-router`/`zod` vía Strapi, `glob`/`minimatch` vía Jest), sin `fixAvailable` y sin bump seguro dentro del semver actual; se mantiene documentado como T6. Multi-replica in-process listeners, SSE sin auth y restock posterior a `ENTREGADO`: decisiones previas (spec §10 / D8).

## 2. Decisiones

| # | Decisión | Origen |
| --- | --- | --- |
| D1 | Quitar `passport-twitter` y su strategy (sin llamadores) para eliminar el critical `xmldom` | Decisión de sesión |
| D2 | `tenant.middleware` gana un modo **Host-only** activable por config; el BFF ya envía headers fiables | Decisión de sesión |
| D3 | Restock solo en `PENDIENTE → CANCELADO`; devuelve stock y revierte uso de cupón; sin reversión de lealtad | Decisión de sesión |
| D4 | `hold.expired` se emite vía `notify-keyspace-events Ex`, con subscriber dedicado en la API | Decisión de sesión |
| D5 | Shutdown hook en la API cierra Redis, servidor HTTP y workers | Decisión de sesión |
| D6 | `ProductResponse.fromEntity` default `available = stock` (no 0) | Decisión de sesión |
| D7 | Un solo plan por fases: Fase 1 seguridad, Fase 2 comportamiento, Fase 3 higiene | Decisión de sesión |

## 3. Fase 1 — Seguridad

### 3.1 Quitar Twitter OAuth (critical)
- `apps/api/package.json`: eliminar `passport-twitter`.
- `apps/api/middleware/authProvider.middleware.ts`: eliminar import, `useTwitterStrategy` y las variables `twitterConsumerID`/`twitterConsumerSecret` del destructuring de config.
- `apps/api/.env.example`: eliminar `TWITTER_CONSUMER_ID`/`TWITTER_CONSUMER_SECRET` (o dejar una nota de deprecado — decidir en el plan).
- `bun install` desde root y verificar `bun audit --json`: 0 advisories de `xmldom` y bajada de critical → 0.
- Nota: los otros tres strategies (Google/Facebook/GitHub) tampoco tienen llamadores, pero **no se tocan** — fuera de alcance.

### 3.2 Modo Host-only en tenant middleware
- Nueva clave de config (ej. `TENANT_TRUST_HOST_ONLY`, default `false` para no romper despliegues actuales; `true` **solo en producción**, nunca en CI).
- En `tenant.middleware.ts`, cuando el flag está activo: ignorar `x-tenant-id`/`x-tenant-slug` y cookies, resolver **solo** desde `Host` (extractSubdomain).
- El BFF (`tenant-request.ts:198-221`) ya reinyerta headers desde Host, así que el cambio es compatible con el flujo normal.
- Tests: con flag off, comportamiento actual (test existente `tenant.middleware.test.ts:82-93` sigue verde); con flag on, un request con header forjado resuelve el tenant del Host.
- Documentar el flag en `.env.example` como recomendado para producción. **NO habilitarlo en CI**: las suites de integración de la API autentican con `x-tenant-slug` por diseño (test-client.ts) y el modo Host-only ya está cubierto por el test unitario; activarlo en CI rompería el gate sin aportar seguridad.

## 4. Fase 2 — Comportamiento

### 4.1 Cancelación de órdenes con restock
- Añadir `CANCELADO` a los 3 sitios: `prisma/schema.prisma:233-238`, `packages/commons/src/enums/order.ts:4-9`, `get-order-statuses.use-case.ts:5-10`. Actualizar `enums.test.ts:80` que hoy asevera que `CANCELADO` se rechaza.
- `order.policy.ts:9-14`: añadir `PENDIENTE → CANCELADO`; `CANCELADO` terminal.
- `change-order-status.use-case.ts:21-26`: añadir `CANCELADO` a la lista válida.
- En `order.prisma-repository.ts:455+`, dentro del `$transaction` existente y **solo cuando `expectedStatus === PENDIENTE` y el nuevo estado es `CANCELADO`**: leer `tx.orderItem` de la orden y hacer `tx.product.updateMany({ data: { stock: { increment: amount } } })` por item, más decremento condicional de `usageCount` del cupón si aplica. Idempotente por el CAS de estado (`count === 0 → null`).
- Sin reversión de lealtad (se otorga en `ENTREGADO`, inalcanzable desde `CANCELADO`).
- Tests: cancelar PENDIENTE devuelve stock + cupón; cancelar PAGADO se rechaza; doble cancelación no duplica stock; concurrencia (CAS) sigue dando `ORDER_STATUS_CONFLICT`.

### 4.2 `hold.expired` real
- `apps/api/docker-compose.yml` y `.prod.yml`: añadir `command: ["redis-server", "--notify-keyspace-events", "Ex"]` al servicio `redis` (o archivo de config montado; decidir en el plan).
- Nuevo `RedisExpirySubscriber` en `infrastructure/providers`: cliente **dedicado** (el modo subscriber no permite comandos normales), suscrito a `__keyevent@0__:expired`. Parsea la clave `hold:<type>:<tenantId>:<resourceId>` mediante un helper inverso en `@neutra/commons` (`parseHoldKey`) y publica `hold.expired` por `IEventBus`.
- Nota: el valor del hold solo guarda `ownerId`, pero el **tenant ya está en la clave**, así que no hace falta cambiar el formato guardado.
- Los eventos de expiración son at-most-once y no se pueden replay; la UI conserva el re-fetch de 30 s.
- Tests: expirar un hold real contra Redis de test → mensaje `hold.expired` en el canal `neutra:availability` con tenant/resource correctos; clave malformada → no publica; otro tenant → no afecta.

## 5. Fase 3 — Higiene

- **E (shutdown)**: devolver `availabilityClient` en `runtime` (o un `close()`), guardar el handle de `app.listen()` y añadir `SIGTERM`/`SIGINT` → `server.close()` + `quit()` de Redis + `close()` de workers/queues.
- **F (default)**: `ProductResponse.fromEntity` → `available: product.stock`, `held: 0` cuando no se pasan valores explícitos; los use cases de lectura siguen pasando los reales.
- **G (tipos)**: retypear `productsService.getById` a `Pick<IProductResponse, "stock"|"held"|"available">` desde `@neutra/commons`; eliminar el tipo local y el doble cast; corregir el comentario obsoleto.
- **H (generador)**: sembrar `manifestByPath` desde `routeFiles(OUTPUT_API)` en disco en vez de `api-routes.json`; el manifest se encoge al borrar un generated file. Ajustar el test de inventario para que ya no sea tautológico (comparar contra un conjunto esperado explícito).
- **I (config/docs)**: corregir el comentario en `query-provider.tsx:55`; pasar `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` al servicio web en `apps/api/docker-compose.yml` (con defaults localhost:6379).

## 6. Criterios de aceptación

- [ ] `bun audit --json` sin advisories de `xmldom`; 0 críticos.
- [ ] Con `TENANT_TRUST_HOST_ONLY=true`, un header `x-tenant-slug` forjado no cambia el tenant resuelto.
- [ ] Cancelar una orden PENDIENTE devuelve stock y revierte cupón; cancelar PAGADO falla; doble cancelación no duplica stock.
- [ ] Un hold expirado emite `hold.expired` al tenant correcto (test con Redis real).
- [ ] `SIGTERM` cierra servidor, Redis y workers sin conexiones colgantes.
- [ ] `available = stock` por defecto en create/update/search; el front consume tipos de commons sin casts.
- [ ] Borrar un generated route y regenerar reduce el manifest; el test de inventario sigue verde.
- [ ] DoD existente en verde: `verify-dod` 7/7, `verify-web-dod` 7/7, `verify-availability-dod` 8/8, API y web tests en verde, CI de GitHub verde.
- [ ] Sin push salvo autorización; módulos citas/store siguen independientes.

## 7. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Quitar passport-twitter rompa OAuth | `useTwitterStrategy` no tiene llamadores; los otros 3 strategies quedan intactos. Test de typecheck + suite de auth. |
| Host-only rompa despliegues que usan headers | Default `false`; solo se activa explícitamente. El BFF ya envía headers desde Host. |
| Restock duplice stock por concurrencia | El CAS de estado (`count === 0 → null`) make la operación idempotente; test de doble cancelación. |
| Keyspace notifications no disponibles en Redis administrado | Compose propio con `notify-keyspace-events Ex`; si un entorno no lo soporta, el re-fetch de 30 s sigue siendo la red. |
| `SIGTERM` cierre antes de terminar requests | Usar `server.close()` (espera conexiones) con timeout de seguridad; documentar. |
| Cambiar defaults de `available` afecte consumidores | GET ya pasa valores reales; search/create/update reportaban 0 incorrecto. Test de los tres endpoints. |

## 8. Fuera de alcance

- Los 7 advisories restantes de `npm.audit` (transitivos/pinned, sin bump seguro).
- Reversión de lealtad y reembolsos.
- Cancelación desde `PAGADO`/`ENVIADO`/`ENTREGADO`.
- Multi-replica de listeners SSE, autenticación del SSE, CSS/UI nueva.
- Push a GitHub (se hará, si se autoriza, tras validar CI local).
