import { holdKey } from "@neutra/commons";
import { ProductResponse } from "@/core/application/dtos/responses/product/product.response";
import { GetAllProductsUseCase } from "@/core/application/products/get-all-products.use-case";
import { GetProductUseCase } from "@/core/application/products/get-product.use-case";
import type { Product } from "@/core/entities/product.entity";
import type { IHoldProvider } from "@/core/providers/hold-provider.interface";
import type { IProductRepository } from "@/core/repositories/product.repository.interface";

function product(id: string, tenantId = "acme", stock = 5): Product {
    return {
        id,
        name: `Product ${id}`,
        description: "A product",
        image: null,
        price: 100,
        stock,
        active: true,
        ownerId: "owner-1",
        tenantId,
    };
}

/** Counts are supplied by the provider; an expired hold is reported as 0. */
function holdProviderWith(counts: Record<string, number>) {
    const countActive = jest.fn(async (keys: string[]) =>
        Object.fromEntries(keys.map((key) => [key, counts[key] ?? 0])),
    );
    const provider: IHoldProvider = {
        acquire: jest.fn(),
        release: jest.fn(),
        countActive,
    };
    return { provider, countActive };
}

function repositoryWith(products: Product[]): IProductRepository {
    return {
        findAll: jest.fn().mockResolvedValue(products),
        findById: jest
            .fn()
            .mockImplementation(async (_tenantId: string | undefined, id: string) =>
                products.find((candidate) => candidate.id === id) ?? null,
            ),
    } as unknown as IProductRepository;
}

describe("product availability with active holds", () => {
    const p1 = product("p1");
    const p2 = product("p2");
    const p3 = product("p3");
    const key1 = holdKey("product", "acme", "p1");
    const key2 = holdKey("product", "acme", "p2");
    const expiredKey = holdKey("product", "acme", "p3");

    it("lists products with held and available counts from one countActive call", async () => {
        // p2 has two active holds; p3's hold expired (provider reports 0).
        const { provider, countActive } = holdProviderWith({
            [key1]: 1,
            [key2]: 2,
            [expiredKey]: 0,
        });
        const useCase = new GetAllProductsUseCase(
            repositoryWith([p1, p2, p3]),
            provider,
        );

        const result = await useCase.execute("acme");

        expect(result.data).toEqual([
            expect.objectContaining({
                id: "p1",
                stock: 5,
                held: 1,
                available: 4,
            }),
            expect.objectContaining({
                id: "p2",
                stock: 5,
                held: 2,
                available: 3,
            }),
            expect.objectContaining({
                id: "p3",
                stock: 5,
                held: 0,
                available: 5,
            }),
        ]);
        expect(countActive).toHaveBeenCalledTimes(1);
        expect(countActive).toHaveBeenCalledWith([key1, key2, expiredKey]);
    });

    it("clamps available at zero when holds exceed stock", async () => {
        const lowStock = product("low", "acme", 1);
        const lowKey = holdKey("product", "acme", "low");
        const { provider } = holdProviderWith({ [lowKey]: 3 });
        const useCase = new GetAllProductsUseCase(
            repositoryWith([lowStock]),
            provider,
        );

        const result = await useCase.execute("acme");

        expect(result.data).toEqual([
            expect.objectContaining({ stock: 1, held: 3, available: 0 }),
        ]);
    });

    it("returns a single product with its hold counts", async () => {
        const { provider, countActive } = holdProviderWith({ [key2]: 2 });
        const useCase = new GetProductUseCase(repositoryWith([p2]), provider);

        const result = await useCase.execute("acme", "p2");

        expect(result.data).toEqual(
            expect.objectContaining({ stock: 5, held: 2, available: 3 }),
        );
        expect(countActive).toHaveBeenCalledTimes(1);
        expect(countActive).toHaveBeenCalledWith([key2]);
    });

    it("derives the hold tenant from the product record, not the caller", async () => {
        const foreign = product("foreign", "record-tenant");
        const foreignKey = holdKey("product", "record-tenant", "foreign");
        const { provider, countActive } = holdProviderWith({ [foreignKey]: 1 });
        const repository = repositoryWith([foreign]);
        const listResult = await new GetAllProductsUseCase(
            repository,
            provider,
        ).execute(undefined);
        const oneResult = await new GetProductUseCase(
            repository,
            provider,
        ).execute(undefined, "foreign");

        expect(countActive).toHaveBeenNthCalledWith(1, [foreignKey]);
        expect(countActive).toHaveBeenNthCalledWith(2, [foreignKey]);
        expect(listResult.data).toEqual([
            expect.objectContaining({ held: 1, available: 4 }),
        ]);
        expect(oneResult.data).toEqual(
            expect.objectContaining({ held: 1, available: 4 }),
        );
    });

    it("defaults held and available to zero for other fromEntity callers", () => {
        expect(ProductResponse.fromEntity(p1)).toEqual(
            expect.objectContaining({ stock: 5, held: 0, available: 0 }),
        );
    });
});
