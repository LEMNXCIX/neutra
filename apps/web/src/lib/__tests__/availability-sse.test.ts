/**
 * In-realm half of the typed availability SSE bridge:
 *  - the generic tenant event hub extracted out of `content-cache`
 *  - the Redis-fed availability hub that the web server stream subscribes to
 *  - scoped QueryClient invalidation (`["availability", resourceType, tenantId]`)
 *
 * No Redis connection is opened here; the hub is fed synchronously, which is
 * exactly what the server's Redis message handler does after parsing a payload.
 */
import type { HoldEvent } from "@neutra/commons";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
    AVAILABILITY_CHANNEL,
    availabilityListenerCount,
    availabilityQueryKey,
    invalidateAvailability,
    notifyAvailabilityEvent,
    onAvailabilityEvent,
} from "@/lib/availability-events";
import { createTenantEventHub } from "@/lib/content-cache";

const acquired: HoldEvent = {
    type: "hold.acquired",
    tenantId: "t1",
    resourceKey: "hold:appointment:t1:staff-1",
    expiresAt: "2026-11-24T12:00:00.000Z",
};

describe("createTenantEventHub — generic listener registry", () => {
    it("notifies subscribers with the exact value and unsubscribes cleanly", () => {
        const hub = createTenantEventHub<HoldEvent>();
        const seen: HoldEvent[] = [];
        const off = hub.subscribe((event) => seen.push(event));

        expect(hub.count()).toBe(1);
        hub.notify(acquired);
        expect(seen).toEqual([acquired]);

        off();
        expect(hub.count()).toBe(0);
        hub.notify(acquired);
        expect(seen).toHaveLength(1); // no notification after unsubscribe
    });

    it("isolates a throwing subscriber from the remaining listeners", () => {
        const hub = createTenantEventHub<string>();
        const seen: string[] = [];
        hub.subscribe(() => {
            throw new Error("broken subscriber");
        });
        hub.subscribe((value) => seen.push(value));

        expect(() => hub.notify("content:t1")).not.toThrow();
        expect(seen).toEqual(["content:t1"]);
    });
});

describe("availability event bridge", () => {
    it("publishes the shared channel constant", () => {
        expect(AVAILABILITY_CHANNEL).toBe("neutra:availability");
    });

    it("feeds parsed HoldEvents to onAvailabilityEvent subscribers", () => {
        const seen: HoldEvent[] = [];
        const baseline = availabilityListenerCount();
        const off = onAvailabilityEvent((event) => seen.push(event));

        expect(availabilityListenerCount()).toBe(baseline + 1);
        notifyAvailabilityEvent(acquired);
        expect(seen).toEqual([acquired]);

        off();
        expect(availabilityListenerCount()).toBe(baseline);
    });

    it("derives the prefix query key from resourceKey and tenantId", () => {
        expect(availabilityQueryKey(acquired)).toEqual([
            "availability",
            "appointment",
            "t1",
        ]);
        expect(
            availabilityQueryKey({
                type: "stock.changed",
                tenantId: "t2",
                resourceKey: "hold:product:t2:p1",
            }),
        ).toEqual(["availability", "product", "t2"]);
    });

    it("invalidates only [availability, resourceType, tenantId] for a typed event", () => {
        const client = new QueryClient();
        const invalidate = vi.spyOn(client, "invalidateQueries");

        invalidateAvailability(client, acquired);

        expect(invalidate).toHaveBeenCalledTimes(1);
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: ["availability", "appointment", "t1"],
        });
        // A typed event must never trigger a global refetch (legacy-only).
        expect(invalidate).not.toHaveBeenCalledWith();
    });
});
