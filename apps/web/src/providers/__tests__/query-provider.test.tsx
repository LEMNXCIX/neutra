// @vitest-environment happy-dom
/** The browser half of the revalidation bridge: QueryProvider registers its
 *  client and refetches when Strapi publishes new content. */
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { onAvailabilityEvent } from "@/lib/availability-events";
import { notifyContentRevalidated } from "@/lib/content-cache";
import { registeredQueryClientCount } from "@/lib/query-invalidation";
import { QueryProvider } from "@/providers/query-provider";

let captured: QueryClient | undefined;

function CaptureClient() {
    captured = useQueryClient();
    return null;
}

/** Browser-realm consumer: its state can only change via the in-realm hub. */
function AvailabilityConsumer() {
    const [heldResource, setHeldResource] = useState<string | null>(null);
    useEffect(
        () =>
            onAvailabilityEvent((event) => {
                if (event.type === "hold.acquired") {
                    setHeldResource(event.resourceKey);
                }
            }),
        [],
    );
    return <div data-testid="held-resource">{heldResource}</div>;
}

class FakeEventSource {
    static instances: FakeEventSource[] = [];
    handlers = new Map<string, Array<(event: MessageEvent) => void>>();
    closed = false;

    constructor(readonly url: string) {
        FakeEventSource.instances.push(this);
    }

    addEventListener(type: string, handler: (event: MessageEvent) => void) {
        this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
    }

    removeEventListener(type: string, handler: (event: MessageEvent) => void) {
        this.handlers.set(
            type,
            (this.handlers.get(type) ?? []).filter((h) => h !== handler),
        );
    }

    close() {
        this.closed = true;
    }

    emit(type: string, data?: string) {
        for (const handler of this.handlers.get(type) ?? [])
            handler({ data } as MessageEvent);
    }
}

afterEach(() => {
    captured = undefined;
    FakeEventSource.instances.length = 0;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("QueryProvider revalidation bridge", () => {
    it("registers its QueryClient and invalidates it on a content event", () => {
        const baseline = registeredQueryClientCount();
        const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");

        const view = render(
            <QueryProvider>
                <CaptureClient />
            </QueryProvider>,
        );

        expect(captured).toBeInstanceOf(QueryClient);
        expect(registeredQueryClientCount()).toBe(baseline + 1);

        act(() => {
            notifyContentRevalidated("content:tenant-1");
        });
        expect(invalidate).toHaveBeenCalledTimes(1);

        view.unmount();
        expect(registeredQueryClientCount()).toBe(baseline);
    });

    it("subscribes to the server SSE feed and globally refetches on a legacy Strapi tag", () => {
        vi.stubGlobal("EventSource", FakeEventSource);
        const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");

        const view = render(
            <QueryProvider>
                <CaptureClient />
            </QueryProvider>,
        );

        const source = FakeEventSource.instances[0];
        expect(source.url).toBe("/api/revalidate/events");
        act(() => source.emit("message", "content:tenant-1"));
        expect(invalidate).toHaveBeenCalledTimes(1);
        // Legacy Strapi publishes are the only message that refetch everything.
        expect(invalidate).toHaveBeenCalledWith();

        view.unmount();
        expect(source.closed).toBe(true);
    });

    it("invalidates only the availability prefix for a typed HoldEvent", () => {
        vi.stubGlobal("EventSource", FakeEventSource);
        const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");

        const view = render(
            <QueryProvider>
                <CaptureClient />
            </QueryProvider>,
        );

        const source = FakeEventSource.instances[0];
        const event = {
            type: "hold.acquired",
            tenantId: "tenant-1",
            resourceKey: "hold:appointment:tenant-1:staff-1",
        };
        act(() => source.emit("message", JSON.stringify(event)));
        expect(invalidate).toHaveBeenCalledTimes(1);
        expect(invalidate).toHaveBeenCalledWith({
            queryKey: ["availability", "appointment", "tenant-1"],
        });
        expect(invalidate).not.toHaveBeenCalledWith();

        view.unmount();
        expect(source.closed).toBe(true);
    });

    it("feeds a real SSE HoldEvent into an in-realm consumer's state via the hub", () => {
        vi.stubGlobal("EventSource", FakeEventSource);

        const view = render(
            <QueryProvider>
                <AvailabilityConsumer />
            </QueryProvider>,
        );

        const source = FakeEventSource.instances[0];
        const event = {
            type: "hold.acquired",
            tenantId: "tenant-1",
            resourceKey: "hold:product:tenant-1:p1",
            expiresAt: "2026-11-24T12:00:00.000Z",
        };
        // No direct notifyAvailabilityEvent call: the only path to the
        // consumer's state is EventSource -> provider -> browser-realm hub.
        act(() => source.emit("message", JSON.stringify(event)));

        expect(screen.getByTestId("held-resource").textContent).toBe(
            event.resourceKey,
        );

        view.unmount();
        expect(source.closed).toBe(true);
    });
});
