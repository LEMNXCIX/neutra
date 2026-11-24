import type { Request, Response } from "express";
import type { AcquireHoldUseCase } from "@/core/application/availability/acquire-hold.use-case";
import type { ReleaseHoldUseCase } from "@/core/application/availability/release-hold.use-case";
import { HoldConflictError } from "@/core/providers/hold-conflict.error";
import { tenantIdOf } from "@/helpers/request-context.helpers";
import { AppError } from "@/types/app-error";
import { ResourceErrorCodes, SystemErrorCodes } from "@neutra/commons";
import type { AcquireHoldRequest } from "@neutra/commons";

export class HoldsController {
    public constructor(
        private readonly acquireHold: AcquireHoldUseCase,
        private readonly releaseHold: ReleaseHoldUseCase,
    ) {}

    public acquire = async (req: Request, res: Response): Promise<Response> => {
        // Host-derived tenant only: the body's tenantId is accepted by the
        // schema but deliberately ignored here.
        const tenantId = tenantIdOf(req);
        const ownerId = this.ownerIdOf(req);

        try {
            const result = await this.acquireHold.execute(
                tenantId,
                ownerId,
                req.validatedBody as AcquireHoldRequest,
            );
            return res.status(201).json(result);
        } catch (error) {
            if (error instanceof HoldConflictError) {
                // Existing AppError envelope + existing commons code. Mapping
                // stays at the HTTP boundary; the domain port stays transport-free.
                throw new AppError(
                    error.message,
                    409,
                    ResourceErrorCodes.CONFLICT,
                );
            }
            throw error;
        }
    };

    public release = async (req: Request, res: Response): Promise<Response> => {
        const tenantId = tenantIdOf(req);
        const released = await this.releaseHold.execute(
            tenantId,
            this.ownerIdOf(req),
            req.params.key,
        );
        return res.status(200).json({ released });
    };

    private ownerIdOf(req: Request): string {
        const ownerId = req.holdOwnerId;
        if (!ownerId) {
            throw new AppError(
                "Hold owner context is required",
                500,
                SystemErrorCodes.INTERNAL_SERVER_ERROR,
            );
        }
        return ownerId;
    }
}
