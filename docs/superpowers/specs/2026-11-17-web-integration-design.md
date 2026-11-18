# Integración de `apps/web` al monorepo — Design Spec

- **Fecha:** 2026-11-17
- **Estado:** propuesto (pendiente de revisión del usuario y de `writing-plans`)
- **Spec relacionado:** `apps/api/docs/superpowers/specs/2026-11-17-monorepo-migration-design.md` (fase 1, completada)
- **Alcance:** diseño únicamente. Ninguna decisión de esta sesión modifica código de producción.

## 1. Contexto

La fase 1 del monorepo quedó completada en `be7ce94` + el fix de tipos en `cb8990e`: `apps/api`, `apps/cms` y `@neutra/commons` conviven bajo bun workspaces, con contratos Zod como fuente de verdad.

Mientras tanto, `neutra-frontend` terminó su migración a TanStack Start:

| Hecho | Evidencia |
| --- | --- |
| Cutover mergeado en `main` | `75d4d2d Merge rewrite/tanstack-start into main` |
| Sin tag de cierre del cutover | solo `pre-tanstack-start` existe |
| Framework | `@tanstack/react-start` + Vite 8 + React 19, puerto 3001, `BACKEND_API_URL` |
| Rutas servidor | **77** archivos `route.ts` bajo `src/routes/api` (el spec del front decía 75) |
| Contratos duplicados | 13 archivos en `src/types/**`, `src/lib/error-messages.ts` con ~94 códigos y 11 dominios, dos envelopes propios |
| Zod | ausente: ni dependencia ni imports |
| Lockfile / nombre | `package-lock.json` propio; `package.json` se llama `neutra`, igual que el root del monorepo |
| Drift test | `src/lib/__tests__/error-codes.test.ts` lee `api-neutra-v2/types/error-codes.ts` por ruta relativa; si no existe, omite el check y la suite sigue verde |

La fase 1 dejó documentada la degradación de ese drift test como D10, con fix obligatorio en esta fase.

## 2. Decisiones

| # | Decisión | Origen |
| --- | --- | --- |
| D1 | El front consume **todo el contrato de cable** desde `@neutra/commons`: envelope, `ErrorDetail`, 11 familias de códigos, enums y DTOs de request/response | Decisión de sesión — revoca "`src/types` se queda" del spec de TanStack |
| D2 | Importación del historial del front con **Approach B** (remote local + fetch + merge de historiales no relacionados) a `apps/web` | Decisión de sesión — consistente con API y CMS |
| D3 | Paquete renombrado a **`web`**; se elimina su `package-lock.json` y el root `bun.lock` pasa a cubrir los 4 workspaces | Decisión de sesión |
| D4 | **Approach A**: adopción por capas — primero shims de re-export en `src/types/**`, luego borrado de los que no contengan tipos puramente del front | Decisión de sesión |
| D5 | DoD: gates del spec de TanStack (tests, typecheck, build, paridad, smoke Docker con headers de tenant) **+** 0 definiciones duplicadas del contrato y drift test reapuntado y verde | Decisión de sesión |
| D6 | Se corrigen los checks del doctor que bloquean el perfil `ci`: `node.contract`, `package.lock` y `npm.audit`, más el helper de versión de Node | Pedido explícito del usuario |
| D7 | Sin cambio de framework/runtime del front: Vite + TanStack + Node 22. Sin push salvo autorización explícita | Brief original |

## 3. Estructura objetivo

```
neutra/
├── apps/
│   ├── api/       # fase 1
│   ├── cms/       # fase 1
│   └── web/       # NUEVO: TanStack Start (antes neutra-frontend)
├── packages/
│   └── commons/   # SSOT (ya existe)
└── docs/superpowers/specs/...   # este spec
```

Grafo de dependencias:

```
packages/commons  ◄── apps/api
        ▲
        ├── apps/web     (envelope, errores, enums y DTOs; fase 2)
        └── apps/cms     (enums; phase posterior de CMS)
```

`apps/web` declara `"@neutra/commons": "workspace:*"`. `commons` sigue siendo isomórfico (solo Zod + tipos, sin `node:*`/Prisma/Express), requisito ya verificado en la fase 1 y que esta fase no puede romper.

## 4. Propiedad de los contratos

| Artefacto en el front | Destino | Notas |
| --- | --- | --- |
| `src/types/frontend-api.ts` (`ErrorDetail`, `StandardResponse<T>`, envelope de `backend-api.ts`) | `@neutra/commons` | Reemplazar por re-exports de `standardResponseSchema`, `errorDetailSchema` y sus tipos inferidos. El front deja de tener dos envelopes propios. |
| `src/lib/error-messages.ts` (`CODE_MESSAGES`, ~94 códigos) | Códigos → `@neutra/commons`; **texto en español se queda en el front** | El catálogo de códigos se importa; el `CODE_MESSAGES`/`DOMAIN_MESSAGES` con copia UI permanece y se valida contra `ErrorCodes`. |
| `src/types/{category,coupon,tenant,order,...}` (enums y DTOs de dominio) | `@neutra/commons` | Re-exports primero; borrar el archivo cuando no queden tipos locales. |
| `src/types/react-chartjs-2.d.ts` | se queda | Ambient shim, no es contrato de cable. |
| Tipos puramente del front (props de UI, store, formularios) | se quedan | No son contrato compartido. |
| Test de drift | se reata a `@neutra/commons` | Importar `ErrorCodes` desde el paquete en vez de leer un archivo hermano por ruta relativa; se elimina el fallback "si no existe, omitir". Así, un código nuevo en commons rompe el test hasta que el front lo traduzca. |

### Uso de Zod en el front

El front **importa los schemas y sus tipos inferidos** (`z.infer`). No se agrega validación de runtime nueva: los Server Routes BFF siguen reenviando el envelope y los errores tal cual (spec de TanStack §`api-client.ts`). YAGNI: solo se usa `safeParse` donde ya existía validación manual equivalente. `zod` pasa a ser dependencia transitiva vía `@neutra/commons`; el front no necesita declararla directamente salvo que use `z` en su propio código.

## 5. Estrategia de migración por fases

### Fase A — Importación y workspace

1. Crear remote local `web` en el monorepo, `git fetch web`, `git merge --allow-unrelated-histories web/main`, mover el árbol a `apps/web/`.
2. Renombrar `apps/web/package.json` `name` a `web`; eliminar `apps/web/package-lock.json`; `bun install` desde el root.
3. Verificar que el historial contiene `75d4d2d`, `84fd647`, `26a4a12`, `42406be` y el tag `pre-tanstack-start`, y que el front original no fue modificado.

### Fase B — Adopción de contratos

4. Agregar `"@neutra/commons": "workspace:*"` a `apps/web/package.json`.
5. Convertir los archivos de `src/types/**` que son puramente contrato en shims `export ... from "@neutra/commons"`, preservando los nombres exportados para no tocar las 77 rutas ni los services en este paso.
6. Reemplazar los dos envelopes propios por los de commons y ajustar `src/lib/api-client.ts`, `src/lib/backend-api.ts` y `src/lib/api-route-handler.ts`.
7. Reapuntar el test de drift a `ErrorCodes` de commons y mantener el guard activo (sin skip silencioso).
8. Ejecutar vitest, typecheck y build. Solo después, borrar los shims que ya no tienen consumidores y reescribir los imports residuales.

### Fase C — Doctor, CI y cierre

9. Corregir `apps/api/scripts/api-doctor/adapters/project.adapter.ts`: resolver `.github/workflows/CI.yml` y `bun.lock` desde la raíz del monorepo (un nivel sobre `context.rootDir`); hacer que `nodeVersionSatisfiesMinimum` acepte majors posteriores al mínimo (semver `>=`, no igualdad de major).
10. Corregir `audit.adapter.ts` para usar `bun audit` (comando confirmado disponible en bun 1.4.4) en vez de `npm audit`.
11. Agregar `apps/web` a CI: instalación única desde el root, `typecheck`, `test` (vitest), `build` y smoke Docker con `x-tenant-slug`/`x-tenant-id`. El build de Strapi sigue fuera del grafo root (task de fase 1).
12. Verificar el DoD completo y documentar los 77 routes como realidad post-cutover.

## 6. Guardas y CI/Docker

- El guard de arquitectura R1–R11 no cambia: sigue apuntando a `apps/api`. Se agrega un check de "0 definiciones duplicadas del contrato en `apps/web/src/types`" análogo al `isomorfismo` de commons.
- `commons:check` sigue verificando majors de zod y `dist/`; el front consume el mismo `workspace:*`.
- Docker del front: contexto `apps/web` con su Dockerfile (o el existente adaptado), puerto 3001 y `BACKEND_API_URL`. Root `.dockerignore` ya creado en la fase 1 cubre secretos.
- CI con Node 22.x: el helper de versión corregido debe pasar tanto en CI como con Node 26 local.

## 7. Criterios de aceptación ("hecho")

- [ ] `apps/web` existe con historial del front preservado (incluidos `75d4d2d` y el tag `pre-tanstack-start`).
- [ ] `bun install --frozen-lockfile` desde el root con un solo `bun.lock`; sin `package-lock.json` en ningún workspace.
- [ ] `apps/web/package.json` se llama `web` y declara `@neutra/commons: workspace:*`.
- [ ] 0 definiciones duplicadas de envelope/`ErrorDetail`/códigos/enums/DTOs de contrato en `apps/web/src` (verificado por grep).
- [ ] Test de drift importa `ErrorCodes` desde `@neutra/commons` y **falla** si se agrega un código sin traducir (test negativo).
- [ ] `apps/web`: vitest en verde (325 tests según el spec del front; el número exacto se toma del repo), `typecheck` y `build` en verde.
- [ ] Paridad byte-a-byte de los 77 Server Routes frente a las fixtures capturadas; smoke Docker con `x-tenant-slug`/`x-tenant-id`.
- [ ] Doctor: `node.contract`, `package.lock` y `npm.audit` en verde en perfil `ci`; R1–R11 sin cambios.
- [ ] DoD de la fase 1 sigue en verde: 76 suites / 757 tests de la API, `commons:check`, `check:arch`, `verify:production`, `verify-dod.mjs` 7/7.
- [ ] Ningún archivo de `api-neutra-v2` ni de `neutra-frontend` (repos fuente) modificado; sin push salvo autorización.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los 77 routes recién migrados rompan paridad al cambiar imports | Shims primero (Fase B) y parametrización con fixtures antes de borrar archivos. |
| El drift test quede otra vez ciego | Import directo desde commons + test negativo obligatorio en el DoD. |
| El front arrastre su `neutra` como nombre y colisione con el root | Rename a `web` en el mismo commit de importación. |
| El helper de Node del doctor rechace Node 26 local | Comparación semver `>=` en vez de igualdad de major; verificar en perfil `ci` y local. |
| `bun audit` cambie el formato de salida | Adaptar el parser con fixture capturada; si falla, reportar BLOCKED en vez de relajar el check. |
| Strapi vuelva a entrar en el build root | El filtro `--filter=!neutra-cms` ya existe; no tocar. |

## 9. Fuera de alcance

- Cambios de framework/runtime del front (Vite/TanStack se mantienen).
- Integración del CMS con enums de commons (fase posterior distinta).
- Publicar paquetes a npm; todo sigue siendo `workspace:*`.
- Revisar el tag `tanstack-start-cutover` faltante: se documenta, no se crea en este spec.
