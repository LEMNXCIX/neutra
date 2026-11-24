/**
 * Focused coverage of the REAL Redis subscription path. The subscriber module is
 * imported for real — only `redis.createClient` is mocked — so the whole wiring
 * `createClient → connect → subscribe(AVAILABILITY_CHANNEL, cb) → JSON.parse →
 * HoldEventSchema.parse → notifyAvailabilityEvent` is exercised end to end
 * without a live Redis server.
 */
import type { HoldEvent } from "@neutra/commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
    createClient: vi.fn(),
    client: {
        on: vi.fn(),
        connect: vi.fn(),
        subscribe: vi.fn(),
        quit: vi.fn(),
        isOpen: true,
    },
}));

vi.mock("redis", () => ({ createClient: h.createClient }));

import * as availabilityEvents from "@/lib/availability-events";
import { AVAILABILITY_CHANNEL } from "@/lib/availability-events";
import { ensureAvailabilitySubscriber } from "@/lib/availability-subscriber";

const validEvent: HoldEvent = {
    type: "hold.acquired",
    tenantId: "tenant-1",
    resourceKey: "hold:appointment:tenant-1:staff-1",
    expiresAt: "2026-11-24T12:00:00.000Z",
};

describe("ensureAvailabilitySubscriber — real Redis wiring", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        h.client.connect.mockResolvedValue(undefined);
        h.client.subscribe.mockResolvedValue(undefined);
        h.createClient.mockReturnValue(h.client);
    });

    it("subscribes to the availability channel and forwards parsed HoldEvents", async () => {
        const notify = vi.spyOn(availabilityEvents, "notifyAvailabilityEvent");
        const observed: HoldEvent[] = [];
        const off = availabilityEvents.onAvailabilityEvent((event) =>
            observed.push(event),
        );

        try {
            await expect(ensureAvailabilitySubscriber()).resolves.toBe(h.client);

            // createClient → connect → subscribe, exactly once (singleton).
            expect(h.createClient).toHaveBeenCalledTimes(1);
            expect(h.client.connect).toHaveBeenCalledTimes(1);
            expect(h.client.subscribe).toHaveBeenCalledTimes(1);
            expect(h.client.subscribe.mock.calls[0][0]).toBe(
                AVAILABILITY_CHANNEL,
            );
            expect(h.client.subscribe.mock.calls[0][0]).toBe(
                "neutra:availability",
            );

            const onMessage = h.client.subscribe.mock.calls[0][1] as (
                message: string,
            ) => void;
            expect(typeof onMessage).toBe("function");

            // Valid JSON → parsed + schema-validated → notifyAvailabilityEvent.
            expect(() => onMessage(JSON.stringify(validEvent))).not.toThrow();
            expect(notify).toHaveBeenCalledTimes(1);
            expect(notify).toHaveBeenCalledWith(validEvent);
            expect(observed).toEqual([validEvent]);

            // Malformed JSON and schema-invalid payloads must neither escape the
            // callback nor reach the hub.
            expect(() => onMessage("not json")).not.toThrow();
            expect(() =>
                onMessage(
                    JSON.stringify({
                        type: "not.a.real.type",
                        tenantId: "tenant-1",
                        resourceKey: "hold:appointment:tenant-1:staff-1",
                    }),
                ),
            ).not.toThrow();
            expect(notify).toHaveBeenCalledTimes(1);
            expect(observed).toEqual([validEvent]);
        } finally {
            off();
            notify.mockRestore();
        }
    });
});
