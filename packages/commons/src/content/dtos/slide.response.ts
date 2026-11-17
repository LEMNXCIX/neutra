import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";

/** Ported from `responses/slide/slide.response.ts`. */

export const ISlideResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  img: z.string(),
  desc: z.string().nullable().optional(),
  active: z.boolean(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type ISlideResponse = z.infer<typeof ISlideResponseSchema>;
