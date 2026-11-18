// Front-only projection: `CartItem` extends the full front `Product`, and the
// DTO is named `AddToCartDTO` (commons has `AddToCartDto`). Kept local.
import type { Product } from "./product.types";

export interface CartItem extends Product {
    amount: number;
}

export interface Cart {
    id: string;
    userId: string;
    items: CartItem[];
    createdAt: Date;
    updatedAt: Date;
}

export interface AddToCartDTO {
    productId: string;
    amount: number;
}
