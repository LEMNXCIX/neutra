import { z } from "zod";
import {
  booleanQuerySchema,
  dateOrStringSchema,
  numericSchema,
} from "../../_common/dto-primitives.js";
import { CouponTypeSchema } from "../../enums/index.js";

/** Ported from `requests/coupon.request.ts`. */

const stringList = z.array(z.string());

export const CreateCouponDtoSchema = z.object({
  code: z.string().min(1),
  type: CouponTypeSchema,
  value: numericSchema.min(0),
  description: z.string().optional(),
  minPurchaseAmount: numericSchema.min(0).optional(),
  maxDiscountAmount: numericSchema.min(0).optional(),
  usageLimit: numericSchema.min(1).optional(),
  active: booleanQuerySchema.optional(),
  expiresAt: dateOrStringSchema,
  applicableProducts: stringList.optional(),
  applicableCategories: stringList.optional(),
  applicableServices: stringList.optional(),
});
export type CreateCouponDto = z.infer<typeof CreateCouponDtoSchema>;

/** `applicableServices` is create-only: the repository has no update branch. */
export const UpdateCouponDtoSchema = z.object({
  code: z.string().optional(),
  type: CouponTypeSchema.optional(),
  value: numericSchema.min(0).optional(),
  description: z.string().optional(),
  minPurchaseAmount: numericSchema.min(0).optional(),
  maxDiscountAmount: numericSchema.min(0).optional(),
  usageLimit: numericSchema.min(1).optional(),
  active: booleanQuerySchema.optional(),
  expiresAt: dateOrStringSchema.optional(),
  applicableProducts: stringList.optional(),
  applicableCategories: stringList.optional(),
});
export type UpdateCouponDto = z.infer<typeof UpdateCouponDtoSchema>;

export const ValidateCouponDtoSchema = z.object({
  code: z.string().min(1),
  orderTotal: numericSchema.min(0),
  productIds: stringList.optional(),
  categoryIds: stringList.optional(),
  serviceIds: stringList.optional(),
});
export type ValidateCouponDto = z.infer<typeof ValidateCouponDtoSchema>;
