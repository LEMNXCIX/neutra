import type { IEventBus } from "@/core/providers/event-bus.interface";
import type { IHoldProvider } from "@/core/providers/hold-provider.interface";

/**
 * Releases a hold for its owner only. A no-op release emits nothing, so a
 * competing owner cannot invalidate someone else's UI.
 */
export class ReleaseHoldUseCase {
    public constructor(
        private readonly hold: IHoldProvider,
        private readonly eventBus: IEventBus,
    ) {}

    public async execute(
        tenantId: string,
        ownerId: string,
        key: string,
    ): Promise<boolean> {
        // Canonical keys are `hold:<resourceType>:<tenantId>:<resourceId>`.
        // Refuse a key minted for a different tenant before touching Redis.
        if (key.split(":")[2] !== tenantId) return false;

        const released = await this.hold.release(key, ownerId);
        if (!released) return false;

        await this.eventBus.publish({
            type: "hold.released",
            tenantId,
            resourceKey: key,
        });
        return true;
    }
}
