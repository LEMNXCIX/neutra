"use client";

import { QueryClient, QueryClientContext } from "@tanstack/react-query";
import { useContext } from "react";

/**
 * Components shared by the storefront are also rendered in isolation (router
 * parity and virtualization tests) without a `QueryClientProvider`. Reading the
 * context directly and falling back to a local client keeps those renders
 * working, while the real app keeps using the provider's client — which is the
 * one the SSE bridge invalidates.
 */
const fallbackClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
});

export function useOptionalQueryClient(): QueryClient {
    return useContext(QueryClientContext) ?? fallbackClient;
}
