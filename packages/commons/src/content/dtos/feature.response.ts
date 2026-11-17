import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";

/** Ported from `responses/feature/feature.response.ts`. */

export const IFeatureResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.number(),
  createdAt: wireDateSchema.optional(),
});
export type IFeatureResponse = z.infer<typeof IFeatureResponseSchema>;
