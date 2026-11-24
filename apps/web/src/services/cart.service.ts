import type { AcquireHoldRequest } from "@neutra/commons";
import { api } from "@/lib/api-client";
import type { AddToCartDTO, CartItem } from "@/types/cart.types";

/**
 * Cart Service
 * Handles shopping cart API calls
 * Requires authentication
 */
export const cartService = {
    /**
     * Get current user's cart items
     */
    get: async (): Promise<CartItem[]> => {
        const response = await api.get<CartItem[]>("/cart");
        return response;
    },

    /**
     * Create a new cart for user
     */
    create: async (): Promise<CartItem[]> => {
        return api.post<CartItem[]>("/cart");
    },

    /**
     * Add item to cart
     */
    addItem: async (data: AddToCartDTO): Promise<CartItem[]> => {
        return api.post<CartItem[]>("/cart/add", data);
    },

    /**
     * Remove item from cart
     */
    removeItem: async (itemId: string): Promise<CartItem[]> => {
        return api.put<CartItem[]>("/cart/remove", { id: itemId });
    },

    /**
     * Clear entire cart
     */
    clear: async (): Promise<CartItem[]> => {
        return api.delete<CartItem[]>("/cart/clear");
    },

    /**
     * Acquire a short-lived UX hold on a product before adding it to the cart.
     * The authoritative stock decrement still happens at order creation.
     */
    acquireHold: async (
        request: AcquireHoldRequest,
    ): Promise<{ key: string; expiresAt: string }> =>
        api.post<{ key: string; expiresAt: string }>("/holds", request),

    /** Release a hold owned by this browser (no-op for expired/foreign holds). */
    releaseHold: async (key: string): Promise<{ released: boolean }> =>
        api.delete<{ released: boolean }>(`/holds/${encodeURIComponent(key)}`),

    /**
     * Get cart statistics (requires authentication)
     */
    getStats: async (): Promise<{ totalItems: number; totalValue: number }> => {
        return api.get<{ totalItems: number; totalValue: number }>(
            "/cart/stats",
        );
    },
};
