import type { Product } from "@/core/entities/product.entity";
import {
    type ITenantMinimalResponse,
    TenantMinimalResponse,
} from "../shared/tenant-minimal.response";

export interface IProductResponse {
    id: string;
    name: string;
    description: string;
    image: string | null;
    price: number;
    stock: number;
    /** Active UX holds for this product, supplied by the hold provider. */
    held: number;
    /** Never negative: stock minus active holds. */
    available: number;
    active: boolean;
    ownerId: string;
    tenant?: ITenantMinimalResponse;
    createdAt?: Date;
    updatedAt?: Date;
    categories?: Array<{ id: string; name: string }>;
}

export class ProductResponse {
    static fromEntity(
        product: Product,
        held = 0,
        available = 0,
    ): IProductResponse {
        return {
            id: product.id,
            name: product.name,
            description: product.description,
            image: product.image ?? null,
            price: product.price,
            stock: product.stock,
            // Callers outside the read use cases have no hold data; they keep
            // seeing a complete DTO with neutral defaults.
            held,
            available,
            active: product.active,
            ownerId: product.ownerId,
            tenant: product.tenant
                ? TenantMinimalResponse.fromEntity(product.tenant)
                : undefined,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            categories: product.categories,
        };
    }
}
