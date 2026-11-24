import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ICryptoProvider } from "@/core/providers/crypto-provider.interface";
import { NodeCryptoProvider } from "@/infrastructure/providers/node-crypto.provider";

export const HOLD_OWNER_COOKIE = "hold_owner";
/** Seven days, in milliseconds, as required by the cookie contract. */
export const HOLD_OWNER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Anonymous UX identity for holds. The cookie is not a secret: it only lets a
 * browser release the holds it acquired. The value never comes from the body
 * or from `x-tenant-*` headers.
 */
export function createHoldOwnerMiddleware(
    crypto: Pick<ICryptoProvider, "randomUUID"> = new NodeCryptoProvider(),
): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (req.holdOwnerId) {
            next();
            return;
        }

        const existing = req.cookies?.[HOLD_OWNER_COOKIE];
        if (typeof existing === "string" && existing.length > 0) {
            req.holdOwnerId = existing;
            next();
            return;
        }

        const ownerId = crypto.randomUUID();
        req.holdOwnerId = ownerId;
        res.cookie(HOLD_OWNER_COOKIE, ownerId, {
            httpOnly: true,
            sameSite: "lax",
            maxAge: HOLD_OWNER_MAX_AGE_MS,
            path: "/",
        });
        next();
    };
}

/** Ready-to-mount middleware using the runtime's crypto provider type. */
export const holdOwner = createHoldOwnerMiddleware();
