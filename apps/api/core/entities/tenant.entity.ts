/**
 * Local contract shim. The definition now lives in `@neutra/commons`; this
 * module only re-exports it so existing `@/core/entities/*` imports keep
 * working while the API migrates. No definitions are duplicated here.
 */

// T7-a: the tenant domain working-hours shape is exported by commons as
// `TenantWorkingHours` (plain `WorkingHours` is the staff entity's day ->
// single-range shape). The re-exported `TenantConfig.settings.businessHours`
// is typed with that multi-range/null-aware domain type.
export { TenantType } from "@neutra/commons";
export type { Tenant, TenantConfig, TenantWorkingHours } from "@neutra/commons";
