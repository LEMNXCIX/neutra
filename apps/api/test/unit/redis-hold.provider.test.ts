import {
    type HoldRedisClient,
    RedisHoldProvider,
} from "@/infrastructure/providers/redis-hold.provider";

type Entry = { value: string; expiresAt: number };
type SetOpts = { EX?: number; NX?: boolean };

/**
 * Small in-memory stand-in for the Redis commands the hold provider uses.
 * It enforces EX expiry and NX so the tests exercise real hold semantics
 * without a Redis server or the global `redis` jest mock.
 */
function createFakeRedis() {
    const store = new Map<string, Entry>();
    const prune = (key: string) => {
        const entry = store.get(key);
        if (entry && entry.expiresAt <= Date.now()) store.delete(key);
    };

    const spies = {
        set: jest.fn(async (key: string, value: string, options?: SetOpts) => {
            prune(key);
            if (options?.NX && store.has(key)) return null;
            store.set(key, {
                value,
                expiresAt: options?.EX
                    ? Date.now() + options.EX * 1000
                    : Number.POSITIVE_INFINITY,
            });
            return "OK";
        }),
        get: jest.fn(async (key: string) => {
            prune(key);
            return store.get(key)?.value ?? null;
        }),
        del: jest.fn(async (key: string) => {
            prune(key);
            return store.delete(key) ? 1 : 0;
        }),
        mGet: jest.fn(async (keys: string[]) =>
            keys.map((key) => {
                prune(key);
                return store.get(key)?.value ?? null;
            }),
        ),
    };

    return { client: spies as unknown as HoldRedisClient, spies, store };
}

describe("RedisHoldProvider", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("acquire stores only the owner with a native TTL and returns a future expiry", async () => {
        const { client, spies, store } = createFakeRedis();
        const provider = new RedisHoldProvider(client);
        const before = Date.now();

        const result = await provider.acquire("k", "o1", 2);

        expect(result.key).toBe("k");
        expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
            before + 2000,
        );
        expect(result.expiresAt.getTime()).toBeLessThanOrEqual(before + 2000);
        expect(spies.set).toHaveBeenCalledWith("k", "o1", { EX: 2, NX: true });
        expect(store.get("k")).toEqual({
            value: "o1",
            expiresAt: before + 2000,
        });
    });

    it("countActive reports 1 for a held key and 0 for a missing key", async () => {
        const { client } = createFakeRedis();
        const provider = new RedisHoldProvider(client);
        await provider.acquire("k", "o1", 60);

        await expect(provider.countActive(["k", "missing"])).resolves.toEqual({
            k: 1,
            missing: 0,
        });
    });

    it("uses MGET for bulk counting and returns {} for no keys", async () => {
        const { client, spies } = createFakeRedis();
        const provider = new RedisHoldProvider(client);
        await provider.acquire("a", "o1", 60);
        await provider.acquire("b", "o2", 60);

        await expect(provider.countActive(["a", "b", "none"])).resolves.toEqual(
            {
                a: 1,
                b: 1,
                none: 0,
            },
        );
        expect(spies.mGet).toHaveBeenCalledWith(["a", "b", "none"]);
        await expect(provider.countActive([])).resolves.toEqual({});
    });

    it("does not overwrite an existing hold (NX) when another owner acquires it", async () => {
        const { client, spies } = createFakeRedis();
        const provider = new RedisHoldProvider(client);
        await provider.acquire("k", "o1", 60);

        await provider.acquire("k", "o2", 60);

        expect(spies.set).toHaveBeenLastCalledWith("k", "o2", {
            EX: 60,
            NX: true,
        });
        await expect(provider.countActive(["k"])).resolves.toEqual({ k: 1 });
        await expect(provider.release("k", "o2")).resolves.toBe(false);
        await expect(provider.release("k", "o1")).resolves.toBe(true);
    });

    it("release with the wrong owner is a silent no-op and keeps the hold", async () => {
        const { client } = createFakeRedis();
        const provider = new RedisHoldProvider(client);
        await provider.acquire("k", "o1", 60);

        await expect(provider.release("k", "o2")).resolves.toBe(false);
        await expect(provider.countActive(["k"])).resolves.toEqual({ k: 1 });
    });

    it("release with the matching owner deletes the hold via GET + DEL", async () => {
        const { client, spies } = createFakeRedis();
        const provider = new RedisHoldProvider(client);
        await provider.acquire("k", "o1", 60);

        await expect(provider.release("k", "o1")).resolves.toBe(true);
        expect(spies.get).toHaveBeenCalledWith("k");
        expect(spies.del).toHaveBeenCalledWith("k");
        await expect(provider.countActive(["k"])).resolves.toEqual({ k: 0 });
        await expect(provider.release("k", "o1")).resolves.toBe(false);
    });

    it("a hold becomes inactive once its TTL elapses, with no cleanup job", async () => {
        const { client } = createFakeRedis();
        const provider = new RedisHoldProvider(client);
        await provider.acquire("k", "o1", 1);
        await expect(provider.countActive(["k"])).resolves.toEqual({ k: 1 });

        jest.advanceTimersByTime(1001);

        await expect(provider.countActive(["k"])).resolves.toEqual({ k: 0 });
        await expect(provider.release("k", "o1")).resolves.toBe(false);
    });
});
