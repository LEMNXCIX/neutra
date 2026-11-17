import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";

/** Ported from `responses/cart/cart.response.ts`. */

export const ICartProductResponseSchema = z.object({
  name: z.string(),
  price: z.number(),
  image: z.string().nullable(),
  description: z.string().optional(),
});
export type ICartProductResponse = z.infer<typeof ICartProductResponseSchema>;

export const ICartItemResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  amount: z.number(),
  product: ICartProductResponseSchema.optional(),
});
export type ICartItemResponse = z.infer<typeof ICartItemResponseSchema>;

export const ICartResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(ICartItemResponseSchema),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type ICartResponse = z.infer<typeof ICartResponseSchema>;
