/**
 * Server-only Redis pub/sub subscriber for availability events.
 *
 * This module is imported exclusively by the server entry (`src/server.ts`),
 * never by a client component, so the Node-only `redis` driver stays out of the
 * browser bundle. The connection is a process-level singleton: every SSE
 * stream calls `ensureAvailabilitySubscriber()`, but only the first call opens
 * a socket. This is a UX-bridge — a missing or broken Redis must degrade
 * gracefully, never take the web process down.
 */
import { HoldEventSchema } from "@neutra/commons";
import { createClient, type RedisClientType } from "redis";
import {
    AVAILABILITY_CHANNEL,
    notifyAvailabilityEvent,
} from "./availability-events";

let subscribePromise: Promise<RedisClientType | null> | null = null;

function redisUrl(): string {
    const host = process.env.REDIS_HOST || "localhost";
    const port = process.env.REDIS_PORT || "6379";
    return `redis://${host}:${port}`;
}

/**
 * Connect once and forward every `neutra:availability` message into the
 * in-realm hub. Subsequent calls return the same promise. A failed connection
 * clears the singleton so a later SSE request can retry.
 */
export function ensureAvailabilitySubscriber(): Promise<RedisClientType | null> {
    if (!subscribePromise) {
        subscribePromise = (async () => {
            let client: RedisClientType | undefined;
            try {
                client = createClient({
                    url: redisUrl(),
                    password: process.env.REDIS_PASSWORD || undefined,
                });
                // Redis is optional for the UX bridge: never crash the server.
                client.on("error", () => {});
                await client.connect();
                await client.subscribe(AVAILABILITY_CHANNEL, (message) => {
                    try {
                        notifyAvailabilityEvent(
                            HoldEventSchema.parse(JSON.parse(message)),
                        );
                    } catch {
                        // Ignore malformed payloads on the shared channel.
                    }
                });
                return client;
            } catch {
                // Do not leave an open socket behind if connect succeeded but
                // subscribe failed.
                if (client?.isOpen) {
                    void client.quit().catch(() => {});
                }
                // Allow the next SSE request to attempt a fresh connection.
                subscribePromise = null;
                return null;
            }
        })();
    }
    return subscribePromise;
}
