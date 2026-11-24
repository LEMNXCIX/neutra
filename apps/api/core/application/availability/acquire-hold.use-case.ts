import { holdKey, type AcquireHoldRequest } from "@neutra/commons";
import type { IEventBus } from "@/core/providers/event-bus.interface";
import type { IHoldProvider } from "@/core/providers/hold-provider.interface";

/** Short UX hold; the server-derived owner and native Redis TTL do the rest. */
export const DEFAULT_HOLD_TTL_SECONDS = 120;

/**
 * Acquires a generic hold and announces it. Publishing happens only after the
 * provider confirmed the NX write, so contention never emits `hold.acquired`.
 */
export class AcquireHoldUseCase {
    public constructor(
        private readonly hold: IHoldProvider,
        private readonly eventBus: IEventBus,
    ) {}

    public async execute(
        tenantId: string,
        ownerId: string,
        request: AcquireHoldRequest,
    ): Promise<{ key: string; expiresAt: string }> {
        const key = holdKey(request.resourceType, tenantId, request.resourceId);
        const { expiresAt } = await this.hold.acquire(
            key,
            ownerId,
            request.ttlSeconds ?? DEFAULT_HOLD_TTL_SECONDS,
        );
        const expiresAtIso = expiresAt.toISOString();

        await this.eventBus.publish({
            type: "hold.acquired",
            tenantId,
            resourceKey: key,
            expiresAt: expiresAtIso,
        });

        return { key, expiresAt: expiresAtIso };
    }
}
