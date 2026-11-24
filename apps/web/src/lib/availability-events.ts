/**
 * In-realm availability event bridge (isomorphic: safe on both sides of the
 * network boundary).
 *
 * The API publishes `HoldEvent` JSON on a Redis channel. The web server's
 * subscriber parses it and calls `notifyAvailabilityEvent`; every tenant-scoped
 * SSE stream forwards it to its browser, which parses the JSON again and calls
 * `invalidateAvailability`. Keeping the hub here — rather than in the Node-only
 * subscriber module — lets the browser and the tests share the same contract
 * without pulling `redis` into the client bundle.
 *
 * The legacy `content:<tenantId>` Strapi tag continues to travel through
 * `content-cache` untouched; this module never touches that path.
 */
import type { HoldEvent } from "@neutra/commons";
import type { QueryClient } from "@tanstack/react-query";
import { createTenantEventHub } from "./content-cache";

/** Shared channel between the API publisher and the web SSE bridge. */
export const AVAILABILITY_CHANNEL = "neutra:availability";

const availabilityEvents = createTenantEventHub<HoldEvent>();

export function onAvailabilityEvent(
    listener: (event: HoldEvent) => void,
): () => void {
    return availabilityEvents.subscribe(listener);
}

/** Feed one parsed Redis message into every connected SSE stream. */
export function notifyAvailabilityEvent(event: HoldEvent): void {
    availabilityEvents.notify(event);
}

/** Test helper: number of live typed-event subscribers (leak guard). */
export function availabilityListenerCount(): number {
    return availabilityEvents.count();
}

/**
 * `resourceKey` is the canonical `hold:<resourceType>:<tenantId>:<resourceId>`.
 * The availability queries are keyed by the prefix
 * `["availability", resourceType, tenantId]`, so invalidating this prefix
 * refetches all staff/service/date or product variants for that resource.
 */
export function availabilityQueryKey(
    event: HoldEvent,
): readonly ["availability", string, string] {
    const [prefix, resourceType] = event.resourceKey.split(":");
    return [
        "availability",
        prefix === "hold" ? resourceType : "appointment",
        event.tenantId,
    ];
}

/** Scoped invalidation for a typed event — never a global refetch. */
export function invalidateAvailability(
    client: QueryClient,
    event: HoldEvent,
): void {
    void client.invalidateQueries({
        queryKey: [...availabilityQueryKey(event)],
    });
}
