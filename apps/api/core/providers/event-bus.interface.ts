import type { HoldEvent } from "@neutra/commons";

/**
 * Outbound port for availability wire events.
 *
 * The event contract lives in `@neutra/commons` so the web bridge and the API
 * publish the exact same shape; this port carries no transport concerns.
 */
export interface IEventBus {
    publish(event: HoldEvent): Promise<void>;
}
