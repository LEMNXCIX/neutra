/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
export interface CreateRoleDTO {
    name: string;
    description?: string;
    level?: number;
    active?: boolean;
    permissionIds?: string[];
}

export interface UpdateRoleDTO {
    name?: string;
    description?: string;
    level?: number;
    active?: boolean;
    permissionIds?: string[];
}

/**
 * The five fields `RoleCreateData` carries, which is also the allowlist
 * `PrismaRoleRepository.create` copies. `tenantId` is not among them: the
 * repository takes the tenant from its first argument, so a `tenantId` in the
 * body is not what scopes a role.
 */
export type CreateRoleDto = import("@neutra/commons").CreateRoleDto;

export type UpdateRoleDto = import("@neutra/commons").UpdateRoleDto;
