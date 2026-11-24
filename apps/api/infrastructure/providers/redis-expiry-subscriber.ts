import { type HoldEvent, parseHoldKey } from "@neutra/commons";
import type { IEventBus } from "@/core/providers/event-bus.interface";

/** Redis keyspace-event channel carrying keys whose TTL just elapsed (db 0). */
export const HOLD_EXPIRED_CHANNEL = "__keyevent@0__:expired";

/**
 * Only the commands the expiry listener needs. Subscriber mode cannot run
 * SET/GET/PUBLISH, so this client stays separate from the hold/publish client.
 */
export interface HoldExpiryRedisClient {
    readonly isOpen?: boolean;
    connect(): Promise<unknown>;
    configSet(name: string, value: string): Promise<unknown>;
    subscribe(
        channel: string,
        listener: (message: string) => void,
    ): Promise<unknown>;
}

/**
 * Translate Redis TTL expirations into availability wire events.
 *
 * The hold VALUE only stores an ownerId; the tenant and resource are encoded
 * in the KEY (`hold:<type>:<tenantId>:<resourceId>`), so they are parsed back
 * from the expired key. Notifications are at-most-once: if the client is not
 * subscribed when a key expires, no event is replayed.
 */
export async function startHoldExpirySubscriber(
    client: HoldExpiryRedisClient,
    eventBus: IEventBus,
): Promise<void> {
    if (!client.isOpen) {
        await client.connect();
    }
    // Stock redis:7-alpine ships with keyspace events disabled; enabling `Ex`
    // here makes the feature work even when the server was not configured.
    await client.configSet("notify-keyspace-events", "Ex");

    await client.subscribe(HOLD_EXPIRED_CHANNEL, (key) => {
        const parsed = parseHoldKey(key);
        if (!parsed) return; // Ignore every non-hold key.

        const event: HoldEvent = {
            type: "hold.expired",
            tenantId: parsed.tenantId,
            resourceKey: key,
            expiresAt: new Date().toISOString(),
        };
        // At-most-once: never retry a failed publish, just let it go.
        void eventBus.publish(event).catch(() => {});
    });
}
