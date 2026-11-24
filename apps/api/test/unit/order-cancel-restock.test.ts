import { prisma } from "@/config/db.config";
import { GetOrderStatusesUseCase } from "@/core/application/order/get-order-statuses.use-case";
import { canTransitionTo } from "@/core/domain/order/order.policy";
import { PrismaOrderRepository } from "@/infrastructure/database/prisma/order.prisma-repository";

function passTransaction() {
    jest.spyOn(prisma, "$transaction").mockImplementation(
        async (callback: (tx: typeof prisma) => Promise<unknown>) =>
            callback(prisma),
    );
}

function canceledOrderRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "order-1",
        userId: "customer-1",
        status: "CANCELADO",
        trackingNumber: null,
        tenantId: "tenant-1",
        couponId: null,
        subtotal: 100,
        total: 100,
        discountAmount: 0,
        items: [],
        user: { name: "Customer", email: "customer@test" },
        createdAt: new Date("2030-01-01T09:00:00.000Z"),
        updatedAt: new Date("2030-01-01T09:00:00.000Z"),
        ...overrides,
    } as never;
}

function orderItems() {
    return [
        {
            id: "item-1",
            orderId: "order-1",
            productId: "product-1",
            amount: 2,
            price: 50,
        },
        {
            id: "item-2",
            orderId: "order-1",
            productId: "product-2",
            amount: 3,
            price: 20,
        },
    ] as never;
}

const cancel = {
    expectedStatus: "PENDIENTE",
    status: "CANCELADO",
} as const;

describe("cancel pending order with stock restock", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("restocks both products by their item amounts inside the CAS transaction", async () => {
        passTransaction();
        jest.spyOn(prisma.order, "updateMany").mockResolvedValue({
            count: 1,
        } as never);
        jest.spyOn(prisma.order, "findFirst").mockResolvedValue(
            canceledOrderRow(),
        );
        jest.spyOn(prisma.orderItem, "findMany").mockResolvedValue(
            orderItems(),
        );

        const stock: Record<string, number> = {
            "product-1": 10,
            "product-2": 7,
        };
        const productUpdate = jest.spyOn(
            prisma.product,
            "updateMany",
        ) as unknown as jest.Mock;
        productUpdate.mockImplementation(
            async (args: {
                where: { id: string };
                data: { stock: { increment: number } };
            }) => {
                stock[args.where.id] += args.data.stock.increment;
                return { count: 1 };
            },
        );

        const updated = await new PrismaOrderRepository().updateStatus(
            "tenant-1",
            "order-1",
            cancel,
        );

        expect(updated).not.toBeNull();
        expect(updated?.status).toBe("CANCELADO");
        expect(stock).toEqual({ "product-1": 12, "product-2": 10 });
        expect(productUpdate).toHaveBeenCalledTimes(2);
        expect(productUpdate).toHaveBeenCalledWith({
            where: { id: "product-1", tenantId: "tenant-1" },
            data: { stock: { increment: 2 } },
        });
        expect(productUpdate).toHaveBeenCalledWith({
            where: { id: "product-2", tenantId: "tenant-1" },
            data: { stock: { increment: 3 } },
        });
    });

    test("decrements the order coupon usageCount by one, guarded by > 0", async () => {
        passTransaction();
        jest.spyOn(prisma.order, "updateMany").mockResolvedValue({
            count: 1,
        } as never);
        jest.spyOn(prisma.order, "findFirst").mockResolvedValue(
            canceledOrderRow({ couponId: "coupon-1" }),
        );
        jest.spyOn(prisma.orderItem, "findMany").mockResolvedValue(
            orderItems(),
        );
        jest.spyOn(prisma.product, "updateMany").mockResolvedValue({
            count: 1,
        } as never);

        let usageCount = 3;
        const couponUpdate = jest.spyOn(
            prisma.coupon,
            "updateMany",
        ) as unknown as jest.Mock;
        couponUpdate.mockImplementation(
            async (args: {
                where: { usageCount: { gt: number } };
                data: { usageCount: { decrement: number } };
            }) => {
                // Postgres applies the whole where clause, including gt: 0.
                if (usageCount > args.where.usageCount.gt) {
                    usageCount -= args.data.usageCount.decrement;
                }
                return { count: 1 };
            },
        );

        await new PrismaOrderRepository().updateStatus(
            "tenant-1",
            "order-1",
            cancel,
        );

        expect(couponUpdate).toHaveBeenCalledTimes(1);
        expect(couponUpdate).toHaveBeenCalledWith({
            where: {
                id: "coupon-1",
                tenantId: "tenant-1",
                usageCount: { gt: 0 },
            },
            data: { usageCount: { decrement: 1 } },
        });
        expect(usageCount).toBe(2);
    });

    test("PAGADO cannot transition to CANCELADO and CANCELADO is terminal", () => {
        expect(canTransitionTo("PENDIENTE", "CANCELADO")).toBe(true);
        expect(canTransitionTo("PAGADO", "CANCELADO")).toBe(false);
        expect(canTransitionTo("ENVIADO", "CANCELADO")).toBe(false);
        expect(canTransitionTo("ENTREGADO", "CANCELADO")).toBe(false);
        expect(canTransitionTo("CANCELADO", "PENDIENTE")).toBe(false);
        expect(canTransitionTo("CANCELADO", "CANCELADO")).toBe(false);
    });

    test("two concurrent cancellations restock once: the losing CAS returns null", async () => {
        passTransaction();
        const statusUpdate = jest.spyOn(
            prisma.order,
            "updateMany",
        ) as unknown as jest.Mock;
        statusUpdate
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 0 });
        jest.spyOn(prisma.order, "findFirst").mockResolvedValue(
            canceledOrderRow(),
        );
        jest.spyOn(prisma.orderItem, "findMany").mockResolvedValue(
            orderItems(),
        );

        let restockCalls = 0;
        const productUpdate = jest.spyOn(
            prisma.product,
            "updateMany",
        ) as unknown as jest.Mock;
        productUpdate.mockImplementation(async () => {
            restockCalls += 1;
            return { count: 1 };
        });

        const repo = new PrismaOrderRepository();
        const [first, second] = await Promise.all([
            repo.updateStatus("tenant-1", "order-1", cancel),
            repo.updateStatus("tenant-1", "order-1", cancel),
        ]);

        expect(first).not.toBeNull();
        expect(second).toBeNull();
        // One increment per item, never doubled by the lost CAS.
        expect(restockCalls).toBe(2);
    });

    test("get-order-statuses exposes CANCELADO", () => {
        const result = new GetOrderStatusesUseCase().execute();

        expect(result.data).toEqual(
            expect.arrayContaining([
                { value: "CANCELADO", label: "Cancelado" },
            ]),
        );
    });
});
