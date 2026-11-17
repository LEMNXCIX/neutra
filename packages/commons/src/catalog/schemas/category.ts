import { z } from "zod";
import { booleanQuerySchema } from "../../_common/dto-primitives.js";
import { CategoryTypeSchema } from "../../enums/index.js";

/** Ported from `requests/category.request.ts`. */

export const CreateCategoryDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: CategoryTypeSchema.optional(),
  active: booleanQuerySchema.optional(),
});
export type CreateCategoryDto = z.infer<typeof CreateCategoryDtoSchema>;

export const UpdateCategoryDtoSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  type: CategoryTypeSchema.optional(),
  active: booleanQuerySchema.optional(),
});
export type UpdateCategoryDto = z.infer<typeof UpdateCategoryDtoSchema>;
