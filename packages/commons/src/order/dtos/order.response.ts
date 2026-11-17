import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";
import { OrderStatusSchema } from "../../enums/index.js";

/** Ported from `responses/order/order.response.ts`. */

export const IOrderItemResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productId: z.string(),
  amount: z.number(),
  price: z.number(),
  product: z
    .object({
      name: z.string(),
      image: z.string().nullable(),
      price: z.number(),
    })
    .optional(),
});
export type IOrderItemResponse = z.infer<typeof IOrderItemResponseSchema>;

export const IOrderUserResponseSchema = z.object({
  name: z.string(),
  email: z.string(),
});
export type IOrderUserResponse = z.infer<typeof IOrderUserResponseSchema>;

export const IOrderResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: OrderStatusSchema,
  items: z.array(IOrderItemResponseSchema),
  subtotal: z.number(),
  total: z.number(),
  discountAmount: z.number(),
  couponId: z.string().nullable().optional(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
  user: IOrderUserResponseSchema.optional(),
  trackingNumber: z.string().nullable().optional(),
});
export type IOrderResponse = z.infer<typeof IOrderResponseSchema>;
