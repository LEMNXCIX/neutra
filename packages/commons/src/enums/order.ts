import { z } from "zod";

/** Formerly a TS string union in `order.entity.ts`; values are unchanged. */
export const OrderStatusSchema = z.enum({
  PENDIENTE: "PENDIENTE",
  PAGADO: "PAGADO",
  ENVIADO: "ENVIADO",
  ENTREGADO: "ENTREGADO",
});

export const OrderStatus = OrderStatusSchema.enum;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
