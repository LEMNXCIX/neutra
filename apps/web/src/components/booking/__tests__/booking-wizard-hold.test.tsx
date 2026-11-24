// @vitest-environment happy-dom
/**
 * Storefront holds: the wizard acquires a short-lived hold when a slot is
 * picked, reacts to other owners' SSE events and reconciles a 409 at confirm
 * time by releasing its hold and refetching availability.
 */
import {
    QueryClient,
    QueryClientProvider,
    useQueryClient,
} from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notifyAvailabilityEvent } from "@/lib/availability-events";
import { tenantStoreApi } from "@/store/tenant-store";

const shared = vi.hoisted(() => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    future.setHours(0, 0, 0, 0);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    return {
        date,
        tenantId: "tenant-1",
        staffId: "staff-1",
        serviceId: "service-1",
        slotA: "10:00",
        slotB: "10:30",
        push: vi.fn(),
        apiClient: vi.fn(),
        createError: null as (Error & { statusCode?: number }) | null,
    };
});

vi.mock("@/lib/api-client", () => ({ apiClient: shared.apiClient }));

vi.mock("@/lib/navigation", () => ({
    useRouter: () => ({ push: shared.push }),
}));

vi.mock("@/store/auth-store", () => ({
    useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
        selector({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useFeatures", () => ({
    useFeatures: () => ({ isFeatureEnabled: () => false }),
}));

vi.mock("@/lib/error-reporting", () => ({
    reportError: (_error: unknown, fallback: string) => fallback,
}));

vi.mock("@/components/booking/availability-calendar", () => ({
    AvailabilityCalendar: ({
        onChange,
    }: { onChange: (date: string) => void }) => (
        <button type="button" onClick={() => onChange(shared.date)}>
            pick date
        </button>
    ),
}));

import { BookingWizard } from "@/components/booking/booking-wizard";
import type { Service, Staff } from "@/services/booking.service";

let capturedClient: QueryClient | undefined;

function CaptureQueryClient() {
    capturedClient = useQueryClient();
    return null;
}

const service = {
    id: shared.serviceId,
    name: "Corte",
    duration: 30,
    price: 20,
    active: true,
    tenantId: shared.tenantId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
} as Service;

const staff = {
    id: shared.staffId,
    name: "Ana",
    active: true,
    tenantId: shared.tenantId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
} as Staff;

function holdKeyFor(time: string): string {
    return `hold:appointment:${shared.tenantId}:${shared.staffId}:${shared.date}:${time}`;
}

function eventFor(type: "hold.acquired" | "hold.expired", time: string) {
    return {
        type,
        tenantId: shared.tenantId,
        resourceKey: holdKeyFor(time),
        expiresAt: "2030-01-01T12:00:00.000Z",
    } as const;
}

async function renderWizardAtSchedule() {
    const user = userEvent.setup();
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    render(
        <QueryClientProvider client={client}>
            <CaptureQueryClient />
            <BookingWizard
                initialServices={[service]}
                initialStaff={[staff]}
                preSelectedServiceId={shared.serviceId}
            />
        </QueryClientProvider>,
    );

    await user.click(screen.getByText("Ana"));
    await user.click(screen.getByRole("button", { name: "pick date" }));
    await screen.findByRole("button", { name: new RegExp(shared.slotA) });
    return user;
}

beforeEach(() => {
    capturedClient = undefined;
    shared.createError = null;
    shared.push.mockClear();
    shared.apiClient.mockReset();
    tenantStoreApi.set({
        tenantId: shared.tenantId,
        tenantSlug: "booking",
        moduleType: "booking",
    });
    shared.apiClient.mockImplementation(
        (endpoint: string, options?: { method?: string }) => {
            if (endpoint.startsWith("/appointments/availability")) {
                return Promise.resolve([shared.slotA, shared.slotB]);
            }
            if (endpoint === "/holds" && options?.method === "POST") {
                return Promise.resolve({
                    key: holdKeyFor(shared.slotA),
                    expiresAt: "2030-01-01T12:00:00.000Z",
                });
            }
            if (endpoint.startsWith("/holds/") && options?.method === "DELETE") {
                return Promise.resolve({ released: true });
            }
            if (endpoint === "/appointments" && options?.method === "POST") {
                if (shared.createError) return Promise.reject(shared.createError);
                return Promise.resolve({ id: "appointment-1" });
            }
            return Promise.resolve({});
        },
    );
});

describe("booking wizard appointment holds", () => {
    it("acquires an appointment hold when a slot is clicked", async () => {
        const user = await renderWizardAtSchedule();

        await user.click(
            screen.getByRole("button", { name: new RegExp(shared.slotA) }),
        );

        await waitFor(() =>
            expect(shared.apiClient).toHaveBeenCalledWith("/holds", {
                method: "POST",
                body: JSON.stringify({
                    resourceType: "appointment",
                    tenantId: shared.tenantId,
                    resourceId: `${shared.staffId}:${shared.date}:${shared.slotA}`,
                }),
            }),
        );
        await waitFor(() =>
            expect(
                screen.getByRole("button", { name: new RegExp(shared.slotA) }),
            ).toHaveAttribute("data-slot-state", "mine"),
        );
        await waitFor(() => {
            const queries = capturedClient?.getQueryCache().findAll({
                queryKey: [
                    "availability",
                    "appointment",
                    shared.tenantId,
                    shared.staffId,
                    shared.serviceId,
                    shared.date,
                ],
            });
            expect(queries).toHaveLength(1);
            const options = queries?.[0]?.options as
                | { staleTime?: number }
                | undefined;
            expect(options?.staleTime).toBe(0);
        });
    });

    it("ignores the hold.acquired event for its own slot", async () => {
        const user = await renderWizardAtSchedule();

        await user.click(
            screen.getByRole("button", { name: new RegExp(shared.slotA) }),
        );
        await waitFor(() =>
            expect(
                screen.getByRole("button", { name: new RegExp(shared.slotA) }),
            ).toHaveAttribute("data-slot-state", "mine"),
        );
        act(() => {
            notifyAvailabilityEvent(eventFor("hold.acquired", shared.slotA));
        });

        const slot = screen.getByRole("button", {
            name: new RegExp(shared.slotA),
        });
        expect(slot).toBeEnabled();
        expect(slot).toHaveAttribute("data-slot-state", "mine");
        expect(
            screen.queryByText(/alguien está reservando/),
        ).not.toBeInTheDocument();
    });

    it("disables a slot held by another owner and explains why", async () => {
        await renderWizardAtSchedule();

        act(() => {
            notifyAvailabilityEvent(eventFor("hold.acquired", shared.slotA));
        });

        const slot = screen.getByRole("button", {
            name: new RegExp(shared.slotA),
        });
        expect(slot).toBeDisabled();
        expect(slot).toHaveAttribute("data-slot-state", "held-by-other");
        expect(
            screen.getByText(/alguien está reservando/),
        ).toBeInTheDocument();
    });

    it("re-enables the slot when the other owner's hold expires", async () => {
        await renderWizardAtSchedule();

        act(() => {
            notifyAvailabilityEvent(eventFor("hold.acquired", shared.slotA));
        });
        act(() => {
            notifyAvailabilityEvent(eventFor("hold.expired", shared.slotA));
        });

        const slot = screen.getByRole("button", {
            name: new RegExp(shared.slotA),
        });
        expect(slot).toBeEnabled();
        expect(slot).toHaveAttribute("data-slot-state", "available");
        expect(
            screen.queryByText(/alguien está reservando/),
        ).not.toBeInTheDocument();
    });

    it("releases the hold and refetches availability when create returns 409", async () => {
        const user = await renderWizardAtSchedule();

        await user.click(
            screen.getByRole("button", { name: new RegExp(shared.slotA) }),
        );
        await waitFor(() =>
            expect(
                screen.getByRole("button", { name: new RegExp(shared.slotA) }),
            ).toHaveAttribute("data-slot-state", "mine"),
        );
        await user.click(
            screen.getByRole("button", { name: /Revisar detalles/ }),
        );

        shared.createError = Object.assign(
            new Error("The selected time slot is already booked"),
            { statusCode: 409 },
        );
        await user.click(
            screen.getByRole("button", { name: /Confirmar Reserva/ }),
        );

        const createCall = shared.apiClient.mock.calls.find(
            (call) => call[0] === "/appointments" && call[1]?.method === "POST",
        );
        expect(createCall).toBeDefined();
        expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
            holdKey: holdKeyFor(shared.slotA),
        });

        await waitFor(() =>
            expect(shared.apiClient).toHaveBeenCalledWith(
                `/holds/${encodeURIComponent(holdKeyFor(shared.slotA))}`,
                { method: "DELETE" },
            ),
        );
        await waitFor(() => {
            const refetches = shared.apiClient.mock.calls.filter(
                (call) =>
                    typeof call[0] === "string" &&
                    call[0].startsWith("/appointments/availability"),
            );
            expect(refetches).toHaveLength(2);
        });
        expect(shared.push).not.toHaveBeenCalled();
    });

    it("releases its own hold after a successful create", async () => {
        const user = await renderWizardAtSchedule();

        await user.click(
            screen.getByRole("button", { name: new RegExp(shared.slotA) }),
        );
        await waitFor(() =>
            expect(
                screen.getByRole("button", { name: new RegExp(shared.slotA) }),
            ).toHaveAttribute("data-slot-state", "mine"),
        );
        await user.click(
            screen.getByRole("button", { name: /Revisar detalles/ }),
        );
        await user.click(
            screen.getByRole("button", { name: /Confirmar Reserva/ }),
        );

        await waitFor(() =>
            expect(shared.apiClient).toHaveBeenCalledWith(
                `/holds/${encodeURIComponent(holdKeyFor(shared.slotA))}`,
                { method: "DELETE" },
            ),
        );
        await waitFor(() =>
            expect(shared.push).toHaveBeenCalledWith(
                "/appointments?success=true",
            ),
        );
    });
});
