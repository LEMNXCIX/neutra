/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
export interface WorkingHours {
    [day: string]: {
        start: string;
        end: string;
    } | null;
}

export interface CreateStaffDTO {
    userId?: string;
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
    bio?: string;
    active?: boolean;
    workingHours?: WorkingHours;
}

export interface UpdateStaffDTO {
    userId?: string;
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    bio?: string;
    active?: boolean;
    workingHours?: WorkingHours;
}

export interface AssignStaffServiceDTO {
    serviceId: string;
}

export interface SyncStaffServicesDTO {
    serviceIds: string[];
}

/**
 * `workingHours` is asserted as an object rather than as a
 * `WorkingHours`-shaped one: its day keys are open-ended, so the only honest
 * constraint at the edge is "is an object", and the day-level shape is what
 * `working-hours.ts` already resolves and reports on.
 */
export type CreateStaffDto = import("@neutra/commons").CreateStaffDto;

export type UpdateStaffDto = import("@neutra/commons").UpdateStaffDto;

/** The body of `POST /api/staff/:staffId/services`. */
export type AssignStaffServiceDto =
    import("@neutra/commons").AssignStaffServiceDto;

/**
 * The body of `PUT /api/staff/:staffId/services`. An empty list is meaningful
 * here: `SyncStaffServicesUseCase` treats it as "detach every service", so it
 * is asserted as an array and not as a non-empty array.
 */
export type SyncStaffServicesDto =
    import("@neutra/commons").SyncStaffServicesDto;
