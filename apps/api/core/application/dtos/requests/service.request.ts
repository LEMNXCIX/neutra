/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
export interface CreateServiceDTO {
    name: string;
    description?: string;
    duration: number;
    price: number;
    categoryId?: string;
    active?: boolean;
}

export interface UpdateServiceDTO {
    name?: string;
    description?: string;
    duration?: number;
    price?: number;
    categoryId?: string;
    active?: boolean;
}

/**
 * `duration` is the only field `CreateServiceDTO` marks as a number rather
 * than a currency amount, and the repository derives `endTime` from it, so it
 * is asserted as an integer: a fractional duration would silently produce an
 * `endTime` the availability maths never rounds.
 */
export type CreateServiceDto = import("@neutra/commons").CreateServiceDto;

export type UpdateServiceDto = import("@neutra/commons").UpdateServiceDto;
