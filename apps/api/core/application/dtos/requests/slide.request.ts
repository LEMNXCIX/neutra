/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
export interface CreateSlideshowDTO {
    title: string;
    img: string;
    desc?: string;
    active?: boolean;
}

export interface UpdateSlideshowDTO {
    title?: string;
    img?: string;
    desc?: string;
    active?: boolean;
}

/** The four fields `SlideshowCreateData` carries, the repository's own copy list. */
export type CreateSlideshowDto = import("@neutra/commons").CreateSlideshowDto;

export type UpdateSlideshowDto = import("@neutra/commons").UpdateSlideshowDto;
