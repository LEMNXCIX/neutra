/**
 * Local contract shim. The definition now lives in `@neutra/commons`; this
 * module only re-exports it so existing `@/core/entities/*` imports keep
 * working while the API migrates. No definitions are duplicated here.
 */
export { CategoryType } from "@neutra/commons";
export type { Category } from "@neutra/commons";
