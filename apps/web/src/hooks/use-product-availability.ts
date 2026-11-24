"use client";

import { holdKey, type IProductResponse } from "@neutra/commons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { onAvailabilityEvent } from "@/lib/availability-events";
import { useOptionalQueryClient } from "@/lib/optional-query-client";
import { productsService } from "@/services/products.service";
import { isOwnProductHold } from "@/store/tanstack/cart-store";
import { useTenantStore } from "@/store/tenant-store";

export interface UseProductAvailabilityParams {
    productId: string;
    /** Last known `stock` from the rendered card, used until the query lands. */
    fallbackStock?: number;
}

/**
 * Live stock for one storefront product. The API exposes `available`
 * (`stock - active holds`); older responses only carry `stock`, so `available`
 * degrades to it. `staleTime: 0` lets the tenant SSE bridge refetch on every
 * typed `hold:*` event for this tenant via the
 * `["availability", "product", tenantId]` prefix.
 */
export function useProductAvailability({
    productId,
    fallbackStock,
}: UseProductAvailabilityParams) {
    const tenantId = useTenantStore((state) => state.tenantId);
    const queryClient = useOptionalQueryClient();
    const [heldByOther, setHeldByOther] = useState(false);

    const query = useQuery<
        Pick<IProductResponse, "stock" | "held" | "available">
    >(
        {
            queryKey: ["availability", "product", tenantId, productId],
            queryFn: () => productsService.getById(productId),
            enabled: Boolean(tenantId && productId),
            staleTime: 0,
            // Safety net when the SSE bridge is down: periodic + focus re-fetch
            // (spec §6). SSE invalidation stays the primary, low-latency path.
            refetchInterval: 30_000,
            refetchOnWindowFocus: true,
        },
        queryClient,
    );

    useEffect(() => {
        if (!tenantId || !productId) return;
        const key = holdKey("product", tenantId, productId);
        setHeldByOther(false);
        return onAvailabilityEvent((event) => {
            if (event.tenantId !== tenantId || event.resourceKey !== key) {
                return;
            }
            if (event.type === "hold.acquired") {
                // Our own optimistic key is registered before the POST resolves,
                // so an event that beats the response never blocks our button.
                if (isOwnProductHold(event.resourceKey)) return;
                setHeldByOther(true);
                return;
            }
            if (
                event.type === "hold.expired" ||
                event.type === "hold.released"
            ) {
                setHeldByOther(false);
            }
        });
    }, [tenantId, productId]);

    return {
        available: query.data?.available ?? query.data?.stock ?? fallbackStock,
        heldByOther,
        isLoading: query.isFetching,
        refetch: query.refetch,
    };
}
