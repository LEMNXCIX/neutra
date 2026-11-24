import type { HoldEvent } from "@neutra/commons";
import type { IEventBus } from "@/core/providers/event-bus.interface";

/** Shared channel between the API publisher and the web SSE bridge. */
export const AVAILABILITY_CHANNEL = "neutra:availability";

/** Structural client so the composition root owns the connection lifecycle. */
export interface PubSubRedisClient {
    publish(channel: string, message: string): Promise<number>;
}

export class RedisPubSubProvider implements IEventBus {
    public constructor(private readonly client: PubSubRedisClient) {}

    public async publish(event: HoldEvent): Promise<void> {
        await this.client.publish(AVAILABILITY_CHANNEL, JSON.stringify(event));
    }
}
