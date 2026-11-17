import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";
import { CouponTypeSchema } from "../../enums/index.js";

/** Ported from `responses/coupon/coupon.response.ts`. */

export const ICouponResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: CouponTypeSchema,
  value: z.number(),
  description: z.string().nullable().optional(),
  minPurchaseAmount: z.number().nullable().optional(),
  maxDiscountAmount: z.number().nullable().optional(),
  usageLimit: z.number().nullable().optional(),
  usageCount: z.number(),
  active: z.boolean(),
  expiresAt: wireDateSchema,
  applicableProducts: z.array(z.string()),
  applicableCategories: z.array(z.string()),
  applicableServices: z.array(z.string()),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type ICouponResponse = z.infer<typeof ICouponResponseSchema>;

/** The `Coupon` entity shape used by `CouponValidationResult`. */
export const CouponSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: CouponTypeSchema,
  value: z.number(),
  description: z.string().nullable(),
  ownerId: z.string().nullable(),
  isReward: z.boolean().optional(),
  isLoyaltyTemplate: z.boolean().optional(),
  sourceCouponId: z.string().nullable(),
  minPurchaseAmount: z.number().nullable(),
  maxDiscountAmount: z.number().nullable(),
  usageLimit: z.number().nullable(),
  usageCount: z.number(),
  active: z.boolean(),
  expiresAt: wireDateSchema,
  applicableProducts: z.array(z.string()),
  applicableCategories: z.array(z.string()),
  applicableServices: z.array(z.string()),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
