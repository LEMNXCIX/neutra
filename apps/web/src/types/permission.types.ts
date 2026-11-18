// Permission entity is the shared wire contract; the DTO names below have no
// exact commons counterpart (commons uses `CreatePermissionDto` /
// `UpdatePermissionDto`) and stay front-only.
export type { Permission } from "@neutra/commons";

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
