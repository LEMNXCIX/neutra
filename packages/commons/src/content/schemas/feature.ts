import { z } from "zod";
import { numericSchema } from "../../_common/dto-primitives.js";

/** Ported from `requests/feature.request.ts`. */

export const CreateFeatureDtoSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  price: numericSchema.min(0).optional(),
});
export type CreateFeatureDto = z.infer<typeof CreateFeatureDtoSchema>;

/** `key` is the join key and is deliberately not writable. */
export const UpdateFeatureDtoSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  price: numericSchema.min(0).optional(),
});
export type UpdateFeatureDto = z.infer<typeof UpdateFeatureDtoSchema>;
