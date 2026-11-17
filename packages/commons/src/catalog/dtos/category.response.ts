import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";
import { ITenantMinimalResponseSchema } from "../../_common/dtos/index.js";
import { CategoryTypeSchema } from "../../enums/index.js";

/** Ported from `responses/category/category.response.ts`. */

export const ICategoryResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  type: CategoryTypeSchema,
  active: z.boolean(),
  tenantId: z.string(),
  tenant: ITenantMinimalResponseSchema.optional(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type ICategoryResponse = z.infer<typeof ICategoryResponseSchema>;
