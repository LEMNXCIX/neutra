import { z } from "zod";
import { OrderStatusSchema } from "../../enums/index.js";

/** Ported from `requests/order.request.ts`. */

/** `userId` and `items` are server-owned; the wire body carries `couponCode`. */
export const CreateOrderDtoSchema = z.object({
  couponCode: z.string().optional(),
});
export type CreateOrderDto = z.infer<typeof CreateOrderDtoSchema>;

export const UpdateOrderDtoSchema = z.object({
  status: OrderStatusSchema.optional(),
  trackingNumber: z.string().optional(),
});
export type UpdateOrderDto = z.infer<typeof UpdateOrderDtoSchema>;

export const ChangeOrderStatusDtoSchema = z.object({
  idOrder: z.string(),
  status: OrderStatusSchema,
});
export type ChangeOrderStatusDto = z.infer<typeof ChangeOrderStatusDtoSchema>;
