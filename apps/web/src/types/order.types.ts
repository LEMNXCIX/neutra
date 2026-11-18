import type { Product } from "./product.types";

// `OrderStatus` is the shared wire enum; re-export it under the existing name.
import { OrderStatus } from "@neutra/commons";
export { OrderStatus };

// Order / OrderItem are front-only projections: the UI reads `coupon`,
// `address` and string timestamps that the shared contract does not carry.
export interface OrderItem {
    id: string;
    orderId: string;
    productId: string;
    amount: number;
    price: number;
    product?: Product;
}

export interface Order {
    id: string;
    userId: string;
    status: OrderStatus;
    items: OrderItem[];
    subtotal: number; // Added from API
    total: number; // Added from API
    discountAmount: number; // Added from API
    couponId?: string | null; // Added from API
    trackingNumber?: string | null; // From API
    address?: string | null; // Shipping address
    coupon?: {
        // Applied coupon details
        code: string;
        type: "percent" | "fixed";
        value: number;
        discount: number;
    } | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    user?: {
        name: string;
        email: string;
    };
}

// DTO names have no exact commons counterpart (commons uses
// `CreateOrderDto` / `UpdateOrderDto`).
export interface CreateOrderDTO {
    userId: string;
    items: {
        productId: string;
        amount: number;
        price: number;
    }[];
    couponId?: string;
}

export interface UpdateOrderDTO {
    status?: OrderStatus;
    trackingNumber?: string;
}
