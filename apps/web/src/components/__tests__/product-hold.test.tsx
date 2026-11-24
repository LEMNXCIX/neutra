// @vitest-environment happy-dom
/**
 * Storefront product holds: the grid/detail buttons react to live availability
 * (stock minus holds) and to other owners' SSE events, the cart acquires a
 * short-lived `product` hold around addItem, and checkout reconciles a 422
 * insufficient-stock rejection by refetching availability.
 */
import { holdKey } from "@neutra/commons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyAvailabilityEvent } from "@/lib/availability-events";
import { useAuthStore } from "@/store/auth-store";
import { cartStore } from "@/store/tanstack/cart-store";
import { tenantStoreApi } from "@/store/tenant-store";

const shared = vi.hoisted(() => ({
    tenantId: "tenant-1",
    productId: "product-1",
    availability: { stock: 3, held: 2, available: 1 } as {
        stock: number;
        held?: number;
        available?: number;
    },
    cartItems: [] as Array<{
        id: string;
        productId: string;
        amount: number;
        price: number;
        name: string;
    }>,
    orderRejects: false,
    apiClient: vi.fn(),
    apiFetch: vi.fn(),
    push: vi.fn(),
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        apiClient: shared.apiClient,
        api: {
            get: (endpoint: string, options?: RequestInit) =>
                shared.apiClient(endpoint, { ...options, method: "GET" }),
            post: (endpoint: string, body?: unknown, options?: RequestInit) =>
                shared.apiClient(endpoint, {
                    ...options,
                    method: "POST",
                    body: body ? JSON.stringify(body) : undefined,
                }),
            put: (endpoint: string, body?: unknown, options?: RequestInit) =>
                shared.apiClient(endpoint, {
                    ...options,
                    method: "PUT",
                    body: body ? JSON.stringify(body) : undefined,
                }),
            delete: (endpoint: string, options?: RequestInit) =>
                shared.apiClient(endpoint, { ...options, method: "DELETE" }),
        },
    };
});
vi.mock("@/lib/api-fetch", () => ({ apiFetch: shared.apiFetch }));
vi.mock("@/lib/navigation", () => ({
    useRouter: () => ({ push: shared.push }),
}));
vi.mock("@/hooks/useFeatures", () => ({
    useFeatures: () => ({ isFeatureEnabled: () => true }),
}));
vi.mock("sonner", () => ({
    toast: Object.assign(vi.fn(), shared.toast),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        Link: ({
            to,
            children,
            ...rest
        }: {
            to?: string;
            children?: ReactNode;
            [key: string]: unknown;
        }) =>
            createElement(
                "a",
                { href: typeof to === "string" ? to : "#", ...rest },
                children,
            ),
    };
});

import CartClient from "@/app/(store)/cart/cart-client";
import ProductDetailClient from "@/components/product-detail-client";
import ProductGrid from "@/components/product-grid";

const PRODUCT = {
    id: shared.productId,
    title: "Producto de prueba",
    price: 10,
    stock: 3,
};

const PRODUCT_HOLD_KEY = holdKey("product", shared.tenantId, shared.productId);

function newClient(): QueryClient {
    return new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
    });
}

function renderStorefront(client: QueryClient) {
    return render(
        <QueryClientProvider client={client}>
            <ProductGrid products={[PRODUCT]} />
            <ProductDetailClient product={PRODUCT} />
        </QueryClientProvider>,
    );
}

type ApiCall = [string, { method?: string; body?: string } | undefined];

function apiCalls(): ApiCall[] {
    return shared.apiClient.mock.calls as unknown as ApiCall[];
}

function holdPostCall(): ApiCall | undefined {
    return apiCalls().find(
        (call) => call[0] === "/holds" && call[1]?.method === "POST",
    );
}

function holdDeleteCalls(): string[] {
    return apiCalls()
        .filter(
            (call) =>
                call[0].startsWith("/holds/") && call[1]?.method === "DELETE",
        )
        .map((call) => call[0]);
}

function productAvailabilityCalls(): number {
    return apiCalls().filter(
        (call) => call[0] === `/products/${shared.productId}`,
    ).length;
}

beforeAll(() => {
    if (!globalThis.ResizeObserver) {
        class ResizeObserverStub {
            observe() {}
            unobserve() {}
            disconnect() {}
        }
        globalThis.ResizeObserver =
            ResizeObserverStub as unknown as typeof ResizeObserver;
    }
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
        configurable: true,
        get: () => 900,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get: () => 1200,
    });
});

beforeEach(() => {
    shared.availability = { stock: 3, held: 2, available: 1 };
    shared.cartItems = [];
    shared.orderRejects = false;
    shared.apiClient.mockReset();
    shared.apiFetch.mockReset();
    shared.push.mockReset();
    shared.toast.error.mockReset();
    shared.toast.success.mockReset();

    shared.apiClient.mockImplementation(
        (endpoint: string, options?: { method?: string }) => {
            if (endpoint === `/products/${shared.productId}`) {
                return Promise.resolve({ ...shared.availability });
            }
            if (endpoint === "/products") {
                return Promise.resolve([PRODUCT]);
            }
            if (endpoint === "/cart") {
                return Promise.resolve([...shared.cartItems]);
            }
            if (endpoint === "/cart/add" && options?.method === "POST") {
                return Promise.resolve([]);
            }
            if (endpoint === "/cart/remove" && options?.method === "PUT") {
                return Promise.resolve([]);
            }
            if (endpoint === "/holds" && options?.method === "POST") {
                return Promise.resolve({
                    key: PRODUCT_HOLD_KEY,
                    expiresAt: "2030-01-01T12:00:00.000Z",
                });
            }
            if (
                endpoint.startsWith("/holds/") &&
                options?.method === "DELETE"
            ) {
                return Promise.resolve({ released: true });
            }
            return Promise.resolve({});
        },
    );

    shared.apiFetch.mockImplementation(async (input: string) => {
        if (input === "/api/orders") {
            if (shared.orderRejects) {
                return {
                    ok: false,
                    status: 422,
                    json: async () => ({
                        errors: [
                            {
                                code: "BUSINESS_INSUFFICIENT_STOCK",
                                message: "Insufficient stock",
                            },
                        ],
                    }),
                };
            }
            return {
                ok: true,
                json: async () => ({ order: { id: "order-1" } }),
            };
        }
        return { ok: true, json: async () => ({}) };
    });

    useAuthStore.setState({ user: { id: "user-1", name: "A" } as never });
    tenantStoreApi.set({
        tenantId: shared.tenantId,
        tenantSlug: "store",
        moduleType: "STORE",
    });
    cartStore.setState((prev) => ({
        ...prev,
        items: [],
        holdKeys: {},
        productMap: {},
        coupon: null,
        discount: 0,
        loading: false,
    }));
});

describe("product hold availability", () => {
    it("(a) disables Add when live availability is zero", async () => {
        shared.availability = { stock: 3, held: 3, available: 0 };
        renderStorefront(newClient());

        await waitFor(() => {
            const buttons = screen.getAllByRole("button", {
                name: /Agregar al Carrito/,
            });
            expect(buttons.length).toBeGreaterThan(0);
            buttons.forEach((button) => {
                expect(button).toBeDisabled();
            });
        });
    });

    it("(b) acquires a product hold before adding to the cart", async () => {
        const user = userEvent.setup();
        renderStorefront(newClient());

        await user.click(
            (
                await screen.findAllByRole("button", {
                    name: /Agregar al Carrito/,
                })
            )[0],
        );

        await waitFor(() => {
            const hold = holdPostCall();
            const calls = apiCalls();
            const addIndex = calls.findIndex(
                (call) => call[0] === "/cart/add" && call[1]?.method === "POST",
            );
            expect(hold).toBeDefined();
            expect(addIndex).toBeGreaterThan(-1);
            const holdIndex = calls.indexOf(hold as ApiCall);
            expect(holdIndex).toBeLessThan(addIndex);
        });
        expect(JSON.parse(String(holdPostCall()?.[1]?.body))).toEqual({
            resourceType: "product",
            tenantId: shared.tenantId,
            resourceId: shared.productId,
        });
    });

    it("(c) disables Add and explains a foreign hold", async () => {
        renderStorefront(newClient());
        await screen.findAllByRole("button", { name: /Agregar al Carrito/ });

        act(() => {
            notifyAvailabilityEvent({
                type: "hold.acquired",
                tenantId: shared.tenantId,
                resourceKey: PRODUCT_HOLD_KEY,
            });
        });

        const buttons = screen.getAllByRole("button", {
            name: /lo está agregando otro usuario/,
        });
        expect(buttons.length).toBeGreaterThan(0);
        buttons.forEach((button) => {
            expect(button).toBeDisabled();
        });
    });

    it("ignores the SSE echo of our own product hold", async () => {
        const user = userEvent.setup();
        renderStorefront(newClient());
        await user.click(
            (
                await screen.findAllByRole("button", {
                    name: /Agregar al Carrito/,
                })
            )[0],
        );
        await waitFor(() => expect(holdPostCall()).toBeDefined());

        act(() => {
            notifyAvailabilityEvent({
                type: "hold.acquired",
                tenantId: shared.tenantId,
                resourceKey: PRODUCT_HOLD_KEY,
            });
        });

        expect(
            screen.queryByText(/lo está agregando otro usuario/),
        ).not.toBeInTheDocument();
    });

    it("falls back to stock when the API omits available", async () => {
        shared.availability = { stock: 0 };
        renderStorefront(newClient());

        await waitFor(() => {
            const buttons = screen.getAllByRole("button", {
                name: /Agregar al Carrito/,
            });
            expect(buttons.length).toBeGreaterThan(0);
            buttons.forEach((button) => {
                expect(button).toBeDisabled();
            });
        });
    });

    it("(d) re-enables Add when the foreign hold expires", async () => {
        renderStorefront(newClient());
        await screen.findAllByRole("button", { name: /Agregar al Carrito/ });

        act(() => {
            notifyAvailabilityEvent({
                type: "hold.acquired",
                tenantId: shared.tenantId,
                resourceKey: PRODUCT_HOLD_KEY,
            });
        });
        act(() => {
            notifyAvailabilityEvent({
                type: "hold.expired",
                tenantId: shared.tenantId,
                resourceKey: PRODUCT_HOLD_KEY,
            });
        });

        expect(
            screen.queryByText(/lo está agregando otro usuario/),
        ).not.toBeInTheDocument();
        const buttons = screen.getAllByRole("button", {
            name: /Agregar al Carrito/,
        });
        buttons.forEach((button) => {
            expect(button).toBeEnabled();
        });
    });

    it("(e) shows the stock message and refetches availability on a 422", async () => {
        const user = userEvent.setup();
        const client = newClient();
        seedCartItem();
        render(
            <QueryClientProvider client={client}>
                <ProductGrid products={[PRODUCT]} />
                <CartClient />
            </QueryClientProvider>,
        );
        await screen.findByRole("button", { name: /Agregar al Carrito/ });
        shared.orderRejects = true;
        const before = productAvailabilityCalls();

        await user.type(
            screen.getByPlaceholderText("DIRECCIÓN COMPLETA DE ENVÍO"),
            "Calle 123",
        );
        await user.click(
            screen.getByRole("button", { name: /realizar pedido/i }),
        );

        await waitFor(() =>
            expect(shared.toast.error).toHaveBeenCalledWith(
                "No hay stock suficiente para algunos productos.",
            ),
        );
        await waitFor(() =>
            expect(productAvailabilityCalls()).toBeGreaterThan(before),
        );
    });

    it("releases the product hold when the item leaves the cart", async () => {
        const user = userEvent.setup();
        const client = newClient();
        seedCartItem();
        render(
            <QueryClientProvider client={client}>
                <ProductGrid products={[PRODUCT]} />
                <CartClient />
            </QueryClientProvider>,
        );
        await user.click(
            (
                await screen.findAllByRole("button", {
                    name: /Agregar al Carrito/,
                })
            )[0],
        );
        await waitFor(() => expect(holdPostCall()).toBeDefined());

        await useCartStoreRemove();

        await waitFor(() =>
            expect(holdDeleteCalls()).toContain(
                `/holds/${encodeURIComponent(PRODUCT_HOLD_KEY)}`,
            ),
        );
    });

    it("releases product holds after a successful checkout", async () => {
        const user = userEvent.setup();
        const client = newClient();
        seedCartItem();
        render(
            <QueryClientProvider client={client}>
                <ProductGrid products={[PRODUCT]} />
                <CartClient />
            </QueryClientProvider>,
        );
        await user.click(
            (
                await screen.findAllByRole("button", {
                    name: /Agregar al Carrito/,
                })
            )[0],
        );
        await waitFor(() => expect(holdPostCall()).toBeDefined());

        await user.type(
            screen.getByPlaceholderText("DIRECCIÓN COMPLETA DE ENVÍO"),
            "Calle 123",
        );
        await user.click(
            screen.getByRole("button", { name: /realizar pedido/i }),
        );

        await waitFor(() =>
            expect(holdDeleteCalls()).toContain(
                `/holds/${encodeURIComponent(PRODUCT_HOLD_KEY)}`,
            ),
        );
        expect(shared.push).toHaveBeenCalledWith("/orders/order-1");
    });
});

function seedCartItem() {
    shared.cartItems = [
        {
            id: "cart-item-1",
            productId: shared.productId,
            amount: 1,
            price: 10,
            name: PRODUCT.title,
        },
    ];
}

/** Storage-level removal keeps this assertion independent of remove-button copy. */
async function useCartStoreRemove() {
    const { useCartStore } = await import("@/store/cart-store");
    await useCartStore.getState().removeItem(shared.productId);
}
