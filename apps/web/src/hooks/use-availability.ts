"use client";

import { useQuery } from "@tanstack/react-query";
import { bookingService } from "@/services/booking.service";
import { useTenantStore } from "@/store/tenant-store";

export interface UseAvailabilityParams {
    staffId?: string | null;
    serviceId?: string | null;
    date?: string | null;
}

/**
 * Reactive appointment availability for the booking storefront.
 *
 * `staleTime: 0` is deliberate: the tenant SSE bridge (Task 5) invalidates the
 * `["availability", "appointment", tenantId]` prefix on every typed hold
 * event, and an invalidation only refetches a stale query. The full key keeps
 * each staff/service/date combination independent.
 */
export function useAvailability({
    staffId,
    serviceId,
    date,
}: UseAvailabilityParams) {
    const tenantId = useTenantStore((state) => state.tenantId);

    const query = useQuery<string[]>({
        queryKey: [
            "availability",
            "appointment",
            tenantId,
            staffId,
            serviceId,
            date,
        ],
        queryFn: () => {
            if (!staffId || !serviceId || !date) return [];
            return bookingService.checkAvailability(staffId, serviceId, date);
        },
        enabled: Boolean(tenantId && staffId && serviceId && date),
        staleTime: 0,
        // Safety net when the SSE bridge is down: periodic + focus re-fetch
        // (spec §6). SSE invalidation stays the primary, low-latency path.
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
    });

    return {
        slots: query.data ?? [],
        isLoading: query.isFetching,
        refetch: query.refetch,
    };
}
