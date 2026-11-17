import { z } from "zod";

export const CategoryTypeSchema = z.enum({
  PRODUCT: "PRODUCT",
  SERVICE: "SERVICE",
});

export const CategoryType = CategoryTypeSchema.enum;
export type CategoryType = z.infer<typeof CategoryTypeSchema>;

export const CouponTypeSchema = z.enum({
  PERCENT: "PERCENT",
  FIXED: "FIXED",
});

export const CouponType = CouponTypeSchema.enum;
export type CouponType = z.infer<typeof CouponTypeSchema>;
