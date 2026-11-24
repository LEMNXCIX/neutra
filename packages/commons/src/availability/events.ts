import { z } from "zod";

/**
 * Wire events for real-time availability. Serialized as JSON over Redis
 * pub/sub and forwarded to the web client over SSE.
 */
export const HoldEventSchema = z.object({
	type: z.enum([
		"hold.acquired",
		"hold.released",
		"hold.expired",
		"appointment.created",
		"stock.changed",
	]),
	tenantId: z.string(),
	resourceKey: z.string(),
	expiresAt: z.string().optional(),
});
export type HoldEvent = z.infer<typeof HoldEventSchema>;
