import { z } from "zod";
import { booleanQuerySchema } from "../../_common/dto-primitives.js";

/** Ported from `requests/slide.request.ts`. */

export const CreateSlideshowDtoSchema = z.object({
  title: z.string().min(1),
  img: z.string().min(1),
  desc: z.string().optional(),
  active: booleanQuerySchema.optional(),
});
export type CreateSlideshowDto = z.infer<typeof CreateSlideshowDtoSchema>;

export const UpdateSlideshowDtoSchema = z.object({
  title: z.string().optional(),
  img: z.string().optional(),
  desc: z.string().optional(),
  active: booleanQuerySchema.optional(),
});
export type UpdateSlideshowDto = z.infer<typeof UpdateSlideshowDtoSchema>;
