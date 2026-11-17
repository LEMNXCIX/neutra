/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
import type { CategoryType } from "@/core/entities/category.entity";

export interface CreateCategoryDTO {
    name: string;
    description?: string;
    type?: CategoryType;
    active?: boolean;
}

export interface UpdateCategoryDTO {
    name?: string;
    description?: string;
    type?: CategoryType;
    active?: boolean;
}

/** The four columns `PrismaCategoryRepository.create` copies. */
export type CreateCategoryDto = import("@neutra/commons").CreateCategoryDto;

export type UpdateCategoryDto = import("@neutra/commons").UpdateCategoryDto;
