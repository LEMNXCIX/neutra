import { z } from "zod";
import {
  booleanQuerySchema,
  dateOrStringSchema,
  integerSchema,
} from "../../_common/dto-primitives.js";

/** Ported from `requests/banner.request.ts`. */

export const CreateBannerDtoSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  cta: z.string().optional(),
  ctaUrl: z.string().optional(),
  priority: integerSchema.optional(),
  active: booleanQuerySchema.optional(),
  startsAt: dateOrStringSchema,
  endsAt: dateOrStringSchema,
});
export type CreateBannerDto = z.infer<typeof CreateBannerDtoSchema>;

export const UpdateBannerDtoSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  cta: z.string().optional(),
  ctaUrl: z.string().optional(),
  priority: integerSchema.optional(),
  active: booleanQuerySchema.optional(),
  startsAt: dateOrStringSchema.optional(),
  endsAt: dateOrStringSchema.optional(),
});
export type UpdateBannerDto = z.infer<typeof UpdateBannerDtoSchema>;
