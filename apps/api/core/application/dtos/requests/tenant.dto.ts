/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
import { type TenantConfig, TenantType } from "@/core/entities/tenant.entity";

export type CreateTenantDto = import("@neutra/commons").CreateTenantDto;

export type UpdateTenantDto = import("@neutra/commons").UpdateTenantDto;

export type UpdateTenantFeaturesDto =
    import("@neutra/commons").UpdateTenantFeaturesDto;
