# Disponibilidad en tiempo real (citas e inventario) — Design Spec

- **Fecha:** 2026-11-24
- **Estado:** propuesto (pendiente de revisión del usuario y de `writing-plans`)
- **Alcance:** diseño únicamente. Ninguna decisión de esta sesión modifica código de producción.

## 1. Contexto

El usuario quiere que un cliente vea en tiempo real cómo se registra una cita, para evitar que dos usuarios reserven el mismo horario, y aplicar el mismo patrón al módulo de inventario de la tienda. Aclarado en la sesión: **no hay integración store↔booking**; cada módulo es independiente y comparte solo infraestructura.

### Hallazgos verificados

**Citas (API)**
- `GET /appointments/availability` (`infrastructure/routes/appointment.routes.ts:140-145`) calcula slots en `core/application/booking/get-availability.use-case.ts:137-176`: paso fijo de 30 min, solape `slotStart < appEnd && slotEnd > appStart` (`:162-166`), y excluye solo `CANCELLED`/`NO_SHOW` (`:133-135`).
- `create-appointment.use-case.ts:137-142` llama a `checkAvailability` (un `findMany`) **fuera de transacción** y luego hace `create` en `:190-193`. No hay lock, `@@unique` ni optimistic concurrency en `prisma/schema.prisma:682-685`. Existe riesgo TOCTOU real.
- Las transiciones de estado sí usan CAS (`appointment.prisma-repository.ts:518-544`), pero no la creación de slots.

**Tienda (API)**
- `Product.stock Int @default(0)` (`prisma/schema.prisma:303`). No hay modelo de reserva ni `restock`.
- `add-to-cart.use-case.ts:42-47` valida stock con un snapshot no atómico; `order.prisma-repository.ts:231-243` sí hace decremento condicional `stock: { gte: amount }` dentro de `$transaction` — la garantía fuerte ya existe en checkout.
- `BUSINESS_INSUFFICIENT_STOCK` (`error-codes.ts:78`) → HTTP 422 por `BusinessRuleViolationError`.

**Front**
- El wizard de citas hace una única consulta de disponibilidad (`booking-wizard.tsx:823-847`), sin TanStack Query ni polling; los botones de slot nunca se deshabilitan por otra reserva (`:468-495`).
- Las páginas de producto usan loaders con `stock` del API (`routes/_store/products/index.tsx:57`, `$id/index.tsx:30`); `product-grid.tsx:191-193,330-332` solo deshabilita "Agregar" cuando `stock <= 0`.
- SSE tenant-scoped ya implementado en `apps/web/src/server.ts:58-115`, alimentado solo por el webhook de Strapi (`api-route-handler.ts:1190-1215`); payload = tag `content:<tenantId>`; es process-local (`content-cache.ts:21-29`).
- La API no tiene pub/sub: Redis solo `get/set/del/ping` (`redis.provider.ts`); BullMQ es `enqueue` one-way.

## 2. Decisiones

| # | Decisión | Origen |
| --- | --- | --- |
| D1 | **Approach A**: infraestructura de holds compartida (genérica) + corrección implementada por separado en cada módulo | Decisión de sesión |
| D2 | Los módulos citas e inventario son **independientes**: comparten transporte/holds, no dominio ni datos | Decisión de sesión |
| D3 | El hold se implementa en **Redis con TTL**, con `ownerId` para impedir liberación ajena | Decisión de sesión |
| D4 | Stock visible en tienda = **`stock` DB − holds activos**; el checkout atómico actual sigue siendo la garantía final | Decisión de sesión |
| D5 | Corrección de citas: **lock transaccional `pg_advisory_xact_lock` por `(tenantId, staffId, día)`** + re-check de solapamiento dentro de la transacción | Decisión de sesión |
| D6 | Eventos tipados por Redis pub/sub con bridge al SSE del web; el SSE es **optimización de UX**, no fuente de verdad | Decisión de sesión |
| D7 | Sin cambio de framework/runtime: Express + Node 22 + Prisma 7, TanStack Start | Brief / decisiones previas |
| D8 | Sin `restock` en este corte (deuda documentada); los holds expiran, las órdenes no devuelven stock | Decisión de sesión |

## 3. Estructura objetivo (solo archivos nuevos/modificados relevantes)

```
apps/api/
├── core/
│   ├── providers/hold-provider.interface.ts        # acquire/release/countActive
│   ├── providers/event-bus.interface.ts            # publish(type, tenantId, payload)
│   └── application/{booking,catalog}/...           # reutilizan los providers
├── infrastructure/providers/
│   ├── redis-hold.provider.ts                      # TTL + ownerId
│   ├── redis-pubsub.provider.ts                    # PUBLICAR
│   └── redis.provider.ts                           # ampliado (subscribe no bloqueante si aplica)
└── infrastructure/routes/holds.routes.ts           # POST /holds, DELETE /holds/:key
apps/web/
├── src/server.ts                                   # bridge SSE: payload tipado + filtro tenant
├── src/lib/content-cache.ts                        # registro de listeners (genérico, no CMS-only)
├── src/providers/query-provider.tsx                # invalidación POR KEY, no global
└── src/routes/_booking/book, src/routes/_store/products  # consumen disponibilidad
packages/commons/src/...                            # eventos y envelopes compartidos (si aplica)
```

## 4. Contratos y propiedad

| Artefacto | Dueño | Forma |
| --- | --- | --- |
| `HoldKey` | `@neutra/commons` | `{ resourceType: "appointment" \| "product", tenantId, resourceId }` → clave canónica `hold:<type>:<tenantId>:<resourceId>` |
| `HoldEvent` | `@neutra/commons` | `{ type: "hold.acquired" \| "hold.released" \| "hold.expired" \| "appointment.created" \| "stock.changed", tenantId, resourceKey, expiresAt? }` |
| `AcquireHoldRequest` | `@neutra/commons` (Zod) | `{ resourceType, tenantId, resourceId, ttlSeconds? }`; `ownerId` se toma del servidor, nunca del body |
| `AvailableStock` | API → web | `{ productId, stock, held, available }` |
| Envelope de errores | `@neutra/commons` | sin cambios (ya compartido) |

Nota: `@neutra/commons` sigue siendo isomórfico; los eventos son tipos/Zod puros.

## 5. Estrategia por fases

### Fase A — Corrección de doble reserva en citas (bloqueante)
1. Extraer el re-check de solapamiento a una operación que acepte un cliente/transacción Prisma.
2. Envolver `checkAvailability + create` en `prisma.$transaction` con `pg_advisory_xact_lock(hashtext(tenantId|staffId|day))`.
3. Mapear el conflicto al código existente de 409 (`InvalidStateError` → `RESOURCE_INVALID_STATE`).
4. Test de disputa concurrente: dos solicitudes simultáneas sobre el mismo slot → una 201, otra 409.

### Fase B — HoldService y bus de eventos (infraestructura)
5. Implementar `RedisHoldProvider` con TTL nativo, `ownerId` y `countActive(prefix)`.
6. Implementar `RedisPubSubProvider` y el bridge en `apps/web/src/server.ts`: suscribe, filtra por `tenantId` y re-emite por el SSE existente con payload tipado.
7. Extender el registro de listeners en `content-cache.ts` para que no sea CMS-only.
8. Rutas `POST /holds` y `DELETE /holds/:key`, con `ownerId` derivado de cookie/token anónimo del servidor.

### Fase C — Integración en el storefront de citas
9. El wizard adquiere un hold al seleccionar slot; deshabilita slots con hold ajeno y muestra "alguien está reservando este horario".
10. Al confirmar: el cliente envía el `holdKey` en el body y la API ejecuta la transacción de la Fase A. **El hold es solo UX**: la API NO valida la propiedad del hold ni lo libera. La garantía autoritativa es el lock transaccional de la Fase A (Task 2), que responde 409 a cualquier disputa real; el cliente libera su propio hold tanto al crear con éxito como ante un 409, y recarga disponibilidad en ese caso. `hold_owner` es identidad de UX, no autorización.
11. Suscripción al SSE con invalidación keyed de la query de disponibilidad; re-fetch de seguridad cuando llega cualquier evento.

### Fase D — Integración en inventario de tienda (independiente)
12. `GET /products` (y `/products/:id`) devuelve `stock`, `held`, `available = stock − held`.
13. Al agregar al carrito se adquiere un hold por `productId`; la UI deshabilita "Agregar" cuando `available <= 0`.
14. El checkout mantiene el decremento atómico y libera los holds del comprador al crear la orden.
15. SSE invalida la disponibilidad de productos por evento `stock.changed`/`hold.*`.

## 6. Manejo de errores y concurrencia

- **Hold ajeno**: `release` con distinto `ownerId` → 403 o no-op silencioso (definir en el plan; recomendado no-op para no filtrar existencia).
- **Hold expirado antes de confirmar**: la cita sigue protegida por la transacción de la Fase A; el cliente recibe 409 y recarga disponibilidad. En stock, el checkout atómico rechaza sobreventa con 422.
- **Evento perdido / bridge caído**: el cliente re-fetch periódico (30-60 s) y al enfocar la ventana; el SSE nunca es la única fuente.
- **Multi-replica del web**: el bridge Redis + sticky routing; documentar que el registro in-process de listeners sigue siendo por réplica.
- **Citas**: no confiar en `x-tenant-*` del cliente — la identidad viene del `Host` (`tenant-request.ts:182-187`).

## 7. Guardas, CI y pruebas

- Los guards existentes (`check:arch`, R1–R11, `commons:check`, `verify-web-contracts.mjs`, `verify-dod.mjs`, `verify-web-dod.mjs`) deben seguir en verde. R1–R11 no se relajan.
- La arquitectura hexagonal se conserva: providers en `core/providers`, implementaciones en `infrastructure/providers`, rutas delgadas.
- Tests nuevos exigidos:
  1. dos reservas concurrentes sobre el mismo slot → 201/409;
  2. expiración de hold → evento `hold.expired` y slot/producto disponible otra vez;
  3. `available = stock − holds activos` con dos compradores;
  4. checkout con hold stale → 422 por el decremento atómico;
  5. el bridge SSE no filtra eventos a otro tenant (test existente `server-entry.test.ts:234-261` ampliado).
- CI: no requiere nuevos servicios (Redis ya está en el job); añadir los tests al step existente.

## 8. Criterios de aceptación

- [ ] Dos usuarios concurrentes no pueden confirmar la misma cita: uno 201, otro 409, verificado por test.
- [ ] Un slot seleccionado por un usuario aparece como "en proceso" para los demás en < 2 s vía SSE.
- [ ] Un hold expirado devuelve el slot/producto a disponible y emite `hold.expired`.
- [ ] La tienda muestra `stock`, `held` y `available`; `available = stock − holds`.
- [ ] El checkout sigue rechazando sobreventa aunque el hold esté expirado (422).
- [ ] Los eventos no cruzan tenants (test negativo).
- [ ] Guards y DoD de fases 1 y 2 en verde (API 77/762, web 505, `verify-dod` 7/7, `verify-web-dod` 7/7).
- [ ] Sin cambios de framework/runtime; sin push salvo autorización; módulos citas e inventario sin acoplamiento de dominio.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Lock por día no cubre citas que cruzan medianoche | La clave del lock usa `(tenantId, staffId, día)`; el re-check de solapamiento usa start/end reales, por lo que el lock solo serializa y la corrección la da el re-check transaccional. |
| Redis como punto único de fallo para holds | TTL nativo; si Redis cae, la API sigue protegida por el lock transaccional (citas) y el decremento atómico (stock). El hold es UX. |
| Validación de propiedad del hold en la API | **No se implementa**: el `holdKey` viaja en el body pero la API no comprueba propiedad ni libera el hold (evita acoplar el módulo de citas al proveedor de holds). La garantía es el lock transaccional de Fase A → 409; el cliente libera su propio hold al confirmar (éxito o 409). `hold_owner` es solo identidad UX. |
| Holds abandonados inflando `held` | TTL corto (2 min, configurable) + `countActive` ignora expirados; sin job de limpieza (Redis expira solo). |
| SSE process-local multi-réplica | Bridge Redis + sticky routing documentado; re-fetch de seguridad en el cliente. |
| Stock sin restock (D8) | Deuda explícita; no se resuelve en este corte. |
| Cart global por usuario y tenant scoping débil | La clave del hold incluye `tenantId`; test de no cruce. |

## 10. Fuera de alcance

- Restock al cancelar órdenes.
- Integrar citas dentro de la tienda e-commerce o viceversa (los módulos son independientes).
- Autenticación del SSE (se mantiene el modelo Host-based actual).
- Cambios en el frontend de TanStack Start o en el runtime.
