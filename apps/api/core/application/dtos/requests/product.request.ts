/**
 * Zod-backed shim: the former decorator-based DTO classes here were
 * replaced by inferred types from `@neutra/commons`. The internal
 * `XDTO` interfaces are kept verbatim; routes now consume the shared
 * `<Dto>Schema` values directly.
 */
export interface CreateProductDTO {
    name: string;
    description: string;
    image?: string;
    price: number;
    stock?: number;
    active?: boolean;
    ownerId: string;
    categoryIds?: string[];
}

export interface UpdateProductDTO {
    name?: string;
    description?: string;
    image?: string;
    price?: number;
    stock?: number;
    active?: boolean;
    categoryIds?: string[];
}

export interface SearchProductDTO {
    name: string;
}

/**
 * The body of `POST /api/products` is the client-settable half of
 * `CreateProductData`. `ownerId` is absent on purpose: it is the column
 * `ProductController.create` sets from `req.user.id` after the spread, so it is
 * a server-owned field and a body value for it can never win. The class does
 * not implement `CreateProductDTO` for the same reason.
 */
export type CreateProductDto = import("@neutra/commons").CreateProductDto;

export type UpdateProductDto = import("@neutra/commons").UpdateProductDto;

/** The body of the public `POST /api/products/search`. */
export type SearchProductDto = import("@neutra/commons").SearchProductDto;
