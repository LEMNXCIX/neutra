import type { IHoldProvider } from "@/core/providers/hold-provider.interface";

/** The four Redis commands a hold needs. Kept structural for easy injection. */
export interface HoldRedisClient {
    set(
        key: string,
        value: string,
        options: { EX: number; NX: boolean },
    ): Promise<unknown>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<number>;
    mGet(keys: string[]): Promise<Array<string | null>>;
}

/**
 * Generic Redis hold adapter: native TTL, owner-scoped release, bulk counting.
 * The client is injected so the composition root owns its connection lifecycle.
 * No appointment/product knowledge lives here.
 */
export class RedisHoldProvider implements IHoldProvider {
    public constructor(private readonly client: HoldRedisClient) {}

    public async acquire(
        key: string,
        ownerId: string,
        ttlSeconds: number,
    ): Promise<{ key: string; expiresAt: Date }> {
        // SET key ownerId EX ttl NX: expiry is native, and an existing owner
        // is never overwritten. Only ownerId is stored as the value.
        await this.client.set(key, ownerId, { EX: ttlSeconds, NX: true });
        return { key, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
    }

    public async release(key: string, ownerId: string): Promise<boolean> {
        const currentOwner = await this.client.get(key);
        if (currentOwner !== ownerId) return false;

        await this.client.del(key);
        return true;
    }

    public async countActive(keys: string[]): Promise<Record<string, number>> {
        if (keys.length === 0) return {};

        const values = await this.client.mGet(keys);
        const counts: Record<string, number> = {};
        keys.forEach((key, index) => {
            counts[key] = values[index] == null ? 0 : 1;
        });
        return counts;
    }
}
