/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
/** Positive integer as it arrives in a query string; parsePagination converts it. */
const POSITIVE_INT = /^[1-9]\d*$/;

export type ListAppointmentsQueryDto =
    import("@neutra/commons").ListAppointmentsQueryDto;

export type AttentionAppointmentsQueryDto =
    import("@neutra/commons").AttentionAppointmentsQueryDto;

export type AvailabilityQueryDto =
    import("@neutra/commons").AvailabilityQueryDto;
