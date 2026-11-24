import { z } from "zod";

/**
 * Pure contracts for short-lived resource holds. Persistence, TTL enforcement
 * and transport concerns belong to the callers, not to this isomorphic package.
 */

const holdResourceTypeSchema = z.enum(["appointment", "product"]);

/** Canonical key shared by the API holds and the Redis pub/sub layer. */
export function holdKey(
	resourceType: "appointment" | "product",
	tenantId: string,
	resourceId: string,
): string {
	return `hold:${resourceType}:${tenantId}:${resourceId}`;
}

/** Body accepted when acquiring a hold; TTL defaults to the caller's policy. */
export const AcquireHoldRequestSchema = z.object({
	resourceType: holdResourceTypeSchema,
	tenantId: z.string(),
	resourceId: z.string(),
	ttlSeconds: z.number().int().positive().max(600).optional(),
});
export type AcquireHoldRequest = z.infer<typeof AcquireHoldRequestSchema>;

/** Product stock projection used by availability consumers. */
export type AvailableStock = {
	productId: string;
	stock: number;
	held: number;
	available: number;
};
