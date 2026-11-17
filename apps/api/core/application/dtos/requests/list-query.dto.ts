/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
/** Positive integer as it arrives in a query string; parsePagination converts it. */
const POSITIVE_INT = /^[1-9]\d*$/;

export type PagedQueryDto = import("@neutra/commons").PagedQueryDto;

export type PagedSearchQueryDto = import("@neutra/commons").PagedSearchQueryDto;

export type CategoryListQueryDto =
    import("@neutra/commons").CategoryListQueryDto;

export type CouponListQueryDto = import("@neutra/commons").CouponListQueryDto;

export type DatedQueryDto = import("@neutra/commons").DatedQueryDto;

export type OrderListQueryDto = import("@neutra/commons").OrderListQueryDto;

export type OrderStatusQueryDto = import("@neutra/commons").OrderStatusQueryDto;

export type LogListQueryDto = import("@neutra/commons").LogListQueryDto;

export type SimpleQueryDto = import("@neutra/commons").SimpleQueryDto;

/** `activeOnly` is a literal boolean flag, not any truthy string. */
export type ActiveOnlyQueryDto = import("@neutra/commons").ActiveOnlyQueryDto;
