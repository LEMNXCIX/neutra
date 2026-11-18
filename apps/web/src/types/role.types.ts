// Role entity is the shared wire contract; the DTO names below have no exact
// commons counterpart (commons uses `CreateRoleDto` / `UpdateRoleDto`).
export type { Role } from "@neutra/commons";

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
