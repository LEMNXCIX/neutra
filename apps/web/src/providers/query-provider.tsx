"use client";

import { HoldEventSchema } from "@neutra/commons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
    invalidateAvailability,
    notifyAvailabilityEvent,
} from "@/lib/availability-events";
import {
    CONTENT_TAG_PREFIX,
    onContentRevalidated,
} from "@/lib/content-cache";
import { registerQueryClient } from "@/lib/query-invalidation";

/**
 * QueryProvider - Proveedor de TanStack Query para la aplicación
 *
 * Configura las opciones por defecto para todas las queries:
 * - staleTime: 60 segundos antes de considerar datos obsoletos
 * - refetchOnWindowFocus: desactivado para evitar refetch innecesarios
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minuto
                        refetchOnWindowFocus: false,
                        retry: 1, // Solo un reintento por defecto
                    },
                    mutations: {
                        retry: 0, // No reintentar mutaciones por defecto
                    },
                },
            }),
    );

    // The revalidate webhook runs on the server; in the browser realm the
    // client learns about a publish through the in-realm revalidation event and
    // invalidates its own queries. Registration is reversed on unmount so hot
    // reloads and tests never keep stale clients alive.
    useEffect(() => {
        const unregister = registerQueryClient(queryClient);
        const unsubscribe = onContentRevalidated(() => {
            void queryClient.invalidateQueries();
        });
        return () => {
            unsubscribe();
            unregister();
        };
    }, [queryClient]);

    // A Strapi publish is an HTTP webhook on the server, so the browser needs
    // a delivery channel: the custom server entry exposes an SSE feed. Only
    // legacy `content:` messages trigger a global invalidateQueries(); typed
    // hold events go to notifyAvailabilityEvent plus a scoped
    // invalidateAvailability on ["availability", <type>, <tenantId>]. Guarded
    // so node/happy-dom tests (no EventSource) are unaffected.
    useEffect(() => {
        if (typeof EventSource === "undefined") return;
        const source = new EventSource("/api/revalidate/events");
        const onRevalidated = (message: MessageEvent) => {
            const raw = message?.data;
            if (typeof raw !== "string") return;
            if (raw.startsWith(CONTENT_TAG_PREFIX)) {
                // Legacy Strapi publish: keep the original global refetch.
                void queryClient.invalidateQueries();
                return;
            }
            try {
                const event = HoldEventSchema.parse(JSON.parse(raw));
                // Both halves of the browser realm must be fed: the local hub
                // drives held-by-other slot/store state, while the invalidation
                // refetches this client's availability queries.
                notifyAvailabilityEvent(event);
                invalidateAvailability(queryClient, event);
            } catch {
                // Ignore malformed SSE payloads; never refetch on garbage.
            }
        };
        source.addEventListener("message", onRevalidated);
        return () => {
            source.removeEventListener("message", onRevalidated);
            source.close();
        };
    }, [queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

export default QueryProvider;
