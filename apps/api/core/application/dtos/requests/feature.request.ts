/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
export interface CreateFeatureDTO {
    key: string;
    name: string;
    description?: string;
    category?: string;
    price?: number;
}

export interface UpdateFeatureDTO {
    name?: string;
    description?: string;
    category?: string;
    price?: number;
}

/**
 * The five columns `IFeatureRepository.create` copies. `key` is included
 * because the catalog is keyed by it; `UpdateFeatureDto` deliberately omits
 * it, because `key` is the join key every `TenantFeature` row and every stored
 * `config.features` map is written by.
 */
export type CreateFeatureDto = import("@neutra/commons").CreateFeatureDto;

export type UpdateFeatureDto = import("@neutra/commons").UpdateFeatureDto;
