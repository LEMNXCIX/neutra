// Real-DB counterpart to order-cancel-restock.test.ts: no Prisma method is
// mocked here, so the CAS in updateStatus is exercised by Postgres itself.
// Like appointment-slot-lock.test.ts, fall back to the local test database
// when the caller did not provide one.
process.env.DATABASE_URL ||=
    "postgresql://postgres:postgres@localhost:6432/role_test?schema=public";

const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tenantId = `cancel-db-${unique}`;
const ownerId = `cancel-db-owner-${unique}`;
const userId = `cancel-db-user-${unique}`;
const orderId = `cancel-db-order-${unique}`;
const couponId = `cancel-db-coupon-${unique}`;
const productIds = [
    `cancel-db-p1-${unique}`,
    `cancel-db-p2-${unique}`,
] as const;
const initialStock = [10, 7];
const itemAmounts = [2, 3];

let prisma: typeof import("@/config/db.config").prisma;
let PrismaOrderRepository: typeof import("@/infrastructure/database/prisma/order.prisma-repository").PrismaOrderRepository;

describe("cancel order restock (real Postgres CAS)", () => {
    beforeAll(async () => {
        // Imports happen after the DATABASE_URL fallback is installed.
        ({ prisma } = require("@/config/db.config"));
        ({
            PrismaOrderRepository,
        } = require("@/infrastructure/database/prisma/order.prisma-repository"));

        await prisma.tenant.create({
            data: { id: tenantId, name: "Cancel DB test", slug: tenantId },
        });
        await prisma.user.create({
            data: {
                id: ownerId,
                name: "Cancel DB owner",
                email: `${ownerId}@example.test`,
                password: "not-used",
            },
        });
        await prisma.user.create({
            data: {
                id: userId,
                name: "Cancel DB customer",
                email: `${userId}@example.test`,
                password: "not-used",
            },
        });
        for (let i = 0; i < productIds.length; i += 1) {
            await prisma.product.create({
                data: {
                    id: productIds[i],
                    name: `Cancel DB product ${i + 1}`,
                    description: "restock fixture",
                    price: 50,
                    stock: initialStock[i],
                    ownerId,
                    tenantId,
                },
            });
        }
        await prisma.coupon.create({
            data: {
                id: couponId,
                code: couponId,
                type: "FIXED",
                value: 5,
                expiresAt: new Date("2999-01-01T00:00:00.000Z"),
                tenantId,
                usageCount: 3,
                applicableProducts: [],
                applicableCategories: [],
                applicableServices: [],
            },
        });
        await prisma.order.create({
            data: {
                id: orderId,
                userId,
                tenantId,
                status: "PENDIENTE",
                couponId,
                subtotal: 100,
                discountAmount: 5,
                total: 95,
            },
        });
        await prisma.orderItem.createMany({
            data: productIds.map((productId, i) => ({
                orderId,
                productId,
                amount: itemAmounts[i],
                price: 50,
            })),
        });
    });

    afterAll(async () => {
        if (!prisma) return;
        await prisma.orderItem.deleteMany({ where: { orderId } });
        await prisma.order.deleteMany({ where: { id: orderId } });
        await prisma.coupon.deleteMany({ where: { id: couponId } });
        await prisma.product.deleteMany({ where: { id: { in: [...productIds] } } });
        await prisma.user.deleteMany({
            where: { id: { in: [ownerId, userId] } },
        });
        await prisma.tenant.deleteMany({ where: { id: tenantId } });
        await prisma.$disconnect();
        // db.config owns a pg pool; $disconnect alone leaves its idle timer alive.
        const adapter = (
            prisma as unknown as {
                _engineConfig: {
                    adapter: { externalPool?: { end(): Promise<void> } };
                };
            }
        )._engineConfig.adapter;
        await adapter.externalPool?.end();
    });

    test("two concurrent cancellations restock stock and revert coupon exactly once", async () => {
        // Barrier forces both real transactions to be in flight together; only
        // the transaction wrapper is instrumented, never a Prisma write.
        let firstBegun!: () => void;
        const firstStarted = new Promise<void>((resolve) => {
            firstBegun = resolve;
        });
        let secondBegun!: () => void;
        const secondStarted = new Promise<void>((resolve) => {
            secondBegun = resolve;
        });
        let transactionCalls = 0;
        const transaction = jest.spyOn(
            prisma,
            "$transaction",
        ) as unknown as jest.Mock;
        transaction.mockImplementation(
            async (callback: (tx: typeof prisma) => Promise<unknown>) => {
                if (transactionCalls++ === 0) {
                    firstBegun();
                    await secondStarted;
                } else {
                    secondBegun();
                }
                return callback(prisma);
            },
        );

        const repository = new PrismaOrderRepository();
        const change = {
            expectedStatus: "PENDIENTE",
            status: "CANCELADO",
        } as const;
        try {
            const results = await Promise.all([
                repository.updateStatus(tenantId, orderId, change),
                repository.updateStatus(tenantId, orderId, change),
            ]);

            const winners = results.filter((result) => result !== null);
            const losers = results.filter((result) => result === null);
            expect(winners).toHaveLength(1);
            expect(losers).toHaveLength(1);
            expect(winners[0]?.status).toBe("CANCELADO");
        } finally {
            transaction.mockRestore();
        }

        const products = await prisma.product.findMany({
            where: { id: { in: [...productIds] } },
        });
        const stocks = Object.fromEntries(
            products.map((product) => [product.id, product.stock]),
        );
        // Initial stock + each item's amount exactly once, not twice.
        expect(stocks[productIds[0]]).toBe(12);
        expect(stocks[productIds[1]]).toBe(10);

        const coupon = await prisma.coupon.findUniqueOrThrow({
            where: { id: couponId },
        });
        expect(coupon.usageCount).toBe(2);

        const order = await prisma.order.findUniqueOrThrow({
            where: { id: orderId },
        });
        expect(order.status).toBe("CANCELADO");
    });
});
