import { z } from "zod";
import { numericSchema } from "../../_common/dto-primitives.js";

/** Ported from `requests/cart.request.ts`. */

export const AddToCartDtoSchema = z.object({
  productId: z.string().min(1),
  amount: numericSchema.min(1),
});
export type AddToCartDto = z.infer<typeof AddToCartDtoSchema>;

/** The wire key is `id`, not `productId` — that is what the controller reads. */
export const RemoveFromCartDtoSchema = z.object({
  id: z.string().min(1),
});
export type RemoveFromCartDto = z.infer<typeof RemoveFromCartDtoSchema>;
