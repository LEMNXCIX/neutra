import { z } from "zod";
import { CouponSchema } from "./coupon.response.js";

/** Ported from `responses/coupon/coupon-validation.response.ts`. */

export const CouponValidationResultSchema = z.object({
  valid: z.boolean(),
  coupon: CouponSchema.optional(),
  discountAmount: z.number().optional(),
  message: z.string().optional(),
});
export type CouponValidationResult = z.infer<
  typeof CouponValidationResultSchema
>;
