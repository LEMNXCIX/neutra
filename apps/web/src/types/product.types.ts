// The Product entity is part of the shared wire contract; re-export it under
// the name this module has always exposed.
export type { Product } from "@neutra/commons";

// Front-only DTOs (commons exposes `CreateProductDto` / `UpdateProductDto`,
// a different name and shape), kept unchanged.
export interface CreateProductDTO {
    name: string;
    description: string;
    image?: string;
    price: number;
    stock: number; // Added stock as required field
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
