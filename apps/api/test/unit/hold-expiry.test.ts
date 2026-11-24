import { createRequire } from "node:module";
import path from "node:path";
import { type HoldEvent, HoldEventSchema, holdKey } from "@neutra/commons";
import type { IEventBus } from "@/core/providers/event-bus.interface";
import { startHoldExpirySubscriber } from "@/infrastructure/providers/redis-expiry-subscriber";
import { RedisHoldProvider } from "@/infrastructure/providers/redis-hold.provider";
import {
    AVAILABILITY_CHANNEL,
    RedisPubSubProvider,
} from "@/infrastructure/providers/redis-pubsub.provider";

// Jest maps the bare `redis` specifier to an in-memory mock (test/mocks/redis.mock.ts).
// This suite needs real TTL keyevent notifications, so load the installed driver
// from its absolute path instead. Production code still imports `redis` normally.
const nodeRequire = createRequire(__filename);
const realRedis = nodeRequire(
    path.resolve(__dirname, "../../node_modules/redis"),
) as typeof import("redis");

const HOLD_RESOURCE_KEY = holdKey("product", "t1", "p1");
const GARBAGE_KEY = "basura";
const EXPIRED_CHANNEL = "__keyevent@0__:expired";
const redisUrl = `redis://${process.env.REDIS_HOST || "127.0.0.1"}:${process.env.REDIS_PORT || "6379"}`;

function createRealClient() {
    const client = realRedis.createClient({ url: redisUrl });
    // Swallow per-socket errors; a real connect/subscribe failure still
    // rejects beforeAll and fails the suite.
    client.on("error", () => {});
    return client;
}

type RealClient = ReturnType<typeof createRealClient>;

describe("hold.expired from Redis key expiry", () => {
    let commandClient: RealClient;
    let expiryClient: RealClient;
    let listenerClient: RealClient;
    let monitorClient: RealClient;
    let previousNotify: string | undefined;
    const received: HoldEvent[] = [];
    const expiredKeys: string[] = [];

    beforeAll(async () => {
        commandClient = createRealClient();
        expiryClient = createRealClient();
        listenerClient = createRealClient();
        monitorClient = createRealClient();
        await Promise.all([
            commandClient.connect(),
            expiryClient.connect(),
            listenerClient.connect(),
            monitorClient.connect(),
        ]);

        const config = await commandClient.configGet("notify-keyspace-events");
        previousNotify = config["notify-keyspace-events"];
        await commandClient.configSet("notify-keyspace-events", "Ex");

        await commandClient.del(HOLD_RESOURCE_KEY);
        await commandClient.del(GARBAGE_KEY);

        await listenerClient.subscribe(AVAILABILITY_CHANNEL, (message) => {
            try {
                received.push(HoldEventSchema.parse(JSON.parse(message)));
            } catch {
                // Ignore unrelated traffic on the shared channel.
            }
        });
        await monitorClient.subscribe(EXPIRED_CHANNEL, (key) => {
            expiredKeys.push(key);
        });

        const eventBus: IEventBus = new RedisPubSubProvider(commandClient);
        await startHoldExpirySubscriber(expiryClient, eventBus);
    }, 20000);

    afterAll(async () => {
        await commandClient.del(HOLD_RESOURCE_KEY).catch(() => {});
        await commandClient.del(GARBAGE_KEY).catch(() => {});
        if (previousNotify !== undefined) {
            await commandClient
                .configSet("notify-keyspace-events", previousNotify)
                .catch(() => {});
        }
        await listenerClient.unsubscribe(AVAILABILITY_CHANNEL).catch(() => {});
        await monitorClient.unsubscribe(EXPIRED_CHANNEL).catch(() => {});
        await Promise.all([
            commandClient.quit().catch(() => {}),
            expiryClient.quit().catch(() => {}),
            listenerClient.quit().catch(() => {}),
            monitorClient.quit().catch(() => {}),
        ]);
    });

    it("enables Ex notifications and listens to the expired keyevent channel", async () => {
        const config = await commandClient.configGet("notify-keyspace-events");
        const flags = (config["notify-keyspace-events"] || "").toLowerCase();
        expect(flags).toContain("x");
        expect(flags).toContain("e");
        expect(expiredKeys).toEqual([]);
    });

    it("publishes hold.expired when a hold TTL elapses and ignores non-hold keys", async () => {
        expect(HOLD_RESOURCE_KEY).toBe("hold:product:t1:p1");
        received.length = 0;
        expiredKeys.length = 0;

        const acquired = await new RedisHoldProvider(commandClient).acquire(
            HOLD_RESOURCE_KEY,
            "owner-1",
            1,
        );
        expect(acquired.key).toBe(HOLD_RESOURCE_KEY);
        // Same TTL, but not a hold key: its expiry must be ignored.
        await commandClient.set(GARBAGE_KEY, "x", { EX: 1 });

        const deadline = Date.now() + 10000;
        while (
            (!expiredKeys.includes(HOLD_RESOURCE_KEY) ||
                !expiredKeys.includes(GARBAGE_KEY) ||
                received.length === 0) &&
            Date.now() < deadline
        ) {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }

        // Both keys really expired at Redis level ...
        expect(expiredKeys).toContain(HOLD_RESOURCE_KEY);
        expect(expiredKeys).toContain(GARBAGE_KEY);
        // ... but only the hold key produced an event on neutra:availability.
        expect(received).toEqual([
            expect.objectContaining({
                type: "hold.expired",
                tenantId: "t1",
                resourceKey: HOLD_RESOURCE_KEY,
            }),
        ]);
        const event = received[0];
        if (!event?.expiresAt) throw new Error("missing hold.expired event");
        expect(event.expiresAt).toBe(new Date(event.expiresAt).toISOString());
    }, 20000);
});
