/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
export interface CreatePermissionDTO {
    name: string;
    description?: string;
    active?: boolean;
}

export interface UpdatePermissionDTO {
    name?: string;
    description?: string;
    active?: boolean;
}

/** The three fields of `PermissionCreateData`, the repository's own allowlist. */
export type CreatePermissionDto = import("@neutra/commons").CreatePermissionDto;

export type UpdatePermissionDto = import("@neutra/commons").UpdatePermissionDto;
