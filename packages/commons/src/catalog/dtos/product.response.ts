import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";
import { ITenantMinimalResponseSchema } from "../../_common/dtos/index.js";

/** Ported from `responses/product/product.response.ts`. */

export const IProductResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  image: z.string().nullable(),
  price: z.number(),
  stock: z.number(),
  held: z.number().optional(),
  available: z.number().optional(),
  active: z.boolean(),
  ownerId: z.string(),
  tenant: ITenantMinimalResponseSchema.optional(),
  createdAt: wireDateSchema.optional(),
  updatedAt: wireDateSchema.optional(),
  categories: z
    .array(z.object({ id: z.string(), name: z.string() }))
    .optional(),
});
export type IProductResponse = z.infer<typeof IProductResponseSchema>;
