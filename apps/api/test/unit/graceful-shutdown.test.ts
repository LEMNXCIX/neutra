import type { Server } from "node:http";
import { Queue } from "bullmq";
import { createClient } from "redis";
import { createRuntime } from "@/infrastructure/config/runtime";

// Each Redis client gets its own `quit` spy so the test can prove the cache,
// availability and hold-expiry connections are all released.
jest.mock("redis", () => ({
    createClient: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        quit: jest.fn().mockResolvedValue(undefined),
        set: jest.fn().mockResolvedValue("OK"),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        mGet: jest.fn().mockResolvedValue([]),
        publish: jest.fn().mockResolvedValue(1),
        ping: jest.fn().mockResolvedValue("PONG"),
    })),
}));

jest.mock("bullmq", () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: jest.fn().mockResolvedValue(undefined),
        upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
    })),
    Worker: jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
    })),
}));

jest.mock("@/config/db.config", () => ({
    prisma: {},
    connection: jest.fn().mockResolvedValue(undefined),
    checkDatabaseConnection: jest.fn().mockResolvedValue(undefined),
}));

// JwtProvider validates a secret at construction; shutdown does not use it.
jest.mock("@/infrastructure/providers/jwt.provider", () => ({
    JwtProvider: jest.fn().mockImplementation(() => ({})),
}));

describe("graceful shutdown", () => {
    it("closes every owned connection exactly once", async () => {
        const runtime = createRuntime();
        expect(typeof runtime.close).toBe("function");

        // createRuntime builds clients in this order: availability, hold
        // expiry, then the cache provider's client. Queues are notification
        // then maintenance.
        const clients = (createClient as unknown as jest.Mock).mock.results.map(
            (result) => result.value,
        ) as Array<{
            quit: jest.Mock;
        }>;
        const queues = (Queue as unknown as jest.Mock).mock.results.map(
            (result) => result.value,
        ) as Array<{ close: jest.Mock }>;
        expect(clients).toHaveLength(3);
        expect(queues).toHaveLength(2);
        const [availabilityClient, holdExpiryClient, cacheClient] = clients;
        const [notificationQueue, maintenanceQueue] = queues;

        const server = {
            close: jest.fn().mockImplementation((cb: () => void) => cb()),
        } as unknown as Server;
        const workers = [
            { close: jest.fn().mockResolvedValue(undefined) },
            { close: jest.fn().mockResolvedValue(undefined) },
        ];
        runtime.registerServer(server);
        runtime.registerWorkers(workers);

        await runtime.close();

        expect(server.close).toHaveBeenCalledTimes(1);
        expect(availabilityClient.quit).toHaveBeenCalledTimes(1);
        expect(holdExpiryClient.quit).toHaveBeenCalledTimes(1);
        expect(cacheClient.quit).toHaveBeenCalledTimes(1);
        expect(workers[0].close).toHaveBeenCalledTimes(1);
        expect(workers[1].close).toHaveBeenCalledTimes(1);
        expect(notificationQueue.close).toHaveBeenCalledTimes(1);
        expect(maintenanceQueue.close).toHaveBeenCalledTimes(1);

        // A second signal (or a repeated call) must not close twice.
        await runtime.close();
        expect(server.close).toHaveBeenCalledTimes(1);
        expect(availabilityClient.quit).toHaveBeenCalledTimes(1);
        expect(workers[0].close).toHaveBeenCalledTimes(1);
        expect(notificationQueue.close).toHaveBeenCalledTimes(1);
    });
});
