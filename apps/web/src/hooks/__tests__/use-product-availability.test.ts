// @vitest-environment happy-dom
/**
 * The availability hook consumes the product response contract published by
 * @neutra/commons. The local `ProductStock` mirror (and its double cast) are
 * obsolete: the compile-time assertion below fails typecheck if `getById`
 * drifts from the commons shape, and the source guard fails if the mirror
 * is reintroduced.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IProductResponse } from "@neutra/commons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProductAvailability } from "@/hooks/use-product-availability";
import type { productsService } from "@/services/products.service";
import { tenantStoreApi } from "@/store/tenant-store";

type Availability = Pick<IProductResponse, "stock" | "held" | "available">;

type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false;
type Assert<T extends true> = T;
type GetByIdIsCommonsTyped = Assert<
    Equal<Awaited<ReturnType<typeof productsService.getById>>, Availability>
>;

const shared = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api-client", () => ({
    api: { get: shared.get },
    apiClient: vi.fn(),
    apiFetch: vi.fn(),
    ApiError: class extends Error {},
}));

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
    client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    shared.get.mockReset();
    shared.get.mockResolvedValue({
        stock: 5,
        held: 2,
        available: 3,
    } satisfies Availability);
    tenantStoreApi.set({ tenantId: "acme" });
});

describe("useProductAvailability commons contract", () => {
    it("getById is typed with the commons product response", () => {
        const assertion: GetByIdIsCommonsTyped = true;
        expect(assertion).toBe(true);
    });

    it("returns available from the commons-shaped product response", async () => {
        const { result } = renderHook(
            () => useProductAvailability({ productId: "p1", fallbackStock: 9 }),
            { wrapper },
        );

        await waitFor(() => expect(result.current.available).toBe(3));
        expect(shared.get).toHaveBeenCalledWith("/products/p1");
    });

    it("uses the commons product type without a local mirror or double cast", () => {
        const source = readFileSync(
            join(__dirname, "../use-product-availability.ts"),
            "utf8",
        );

        expect(source).toMatch(/IProductResponse/);
        expect(source).not.toMatch(/\btype\s+ProductStock\b/);
        expect(source).not.toContain("as unknown as");
    });
});
