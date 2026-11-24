import { AcquireHoldRequestSchema } from "@neutra/commons";
import { type Application, Router } from "express";
import type { ICryptoProvider } from "@/core/providers/crypto-provider.interface";
import { NodeCryptoProvider } from "@/infrastructure/providers/node-crypto.provider";
import type { HoldsController } from "@/interface-adapters/controllers/holds.controller";
import { createHoldOwnerMiddleware } from "@/middleware/hold-owner.middleware";
import { validateDto } from "@/middleware/validation.middleware";

/**
 * Generic hold endpoints. Mounted after `tenantMiddleware` so `tenantIdOf`
 * always reads the Host-derived tenant, never a client header or body field.
 */
export function holds(
    app: Application,
    holdsController: HoldsController,
    crypto: ICryptoProvider = new NodeCryptoProvider(),
): void {
    const router = Router();
    app.use("/api/holds", router);
    router.use(createHoldOwnerMiddleware(crypto));

    /**
     * @swagger
     * /holds:
     *   post:
     *     summary: Acquire a short-lived hold on a resource
     *     tags: [Availability]
     *     security: []
     *     responses:
     *       201:
     *         description: Hold acquired
     *       409:
     *         description: Resource already held
     */
    router.post(
        "/",
        validateDto(AcquireHoldRequestSchema),
        holdsController.acquire,
    );

    /**
     * @swagger
     * /holds/{key}:
     *   delete:
     *     summary: Release a hold owned by this browser
     *     tags: [Availability]
     *     security: []
     *     responses:
     *       200:
     *         description: Whether the hold was released by its owner
     */
    router.delete("/:key", holdsController.release);
}

export default holds;
