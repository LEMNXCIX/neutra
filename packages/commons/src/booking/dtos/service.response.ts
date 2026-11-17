import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";
import { ITenantMinimalResponseSchema } from "../../_common/dtos/index.js";

/** Ported from `responses/service/service.response.ts`. */

export const ICategoryMinimalResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type ICategoryMinimalResponse = z.infer<
  typeof ICategoryMinimalResponseSchema
>;

export const IServiceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  duration: z.number(),
  price: z.number(),
  categoryId: z.string().nullable().optional(),
  category: ICategoryMinimalResponseSchema.optional(),
  active: z.boolean(),
  tenantId: z.string(),
  tenant: ITenantMinimalResponseSchema.optional(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type IServiceResponse = z.infer<typeof IServiceResponseSchema>;
