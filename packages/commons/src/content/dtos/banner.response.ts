import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";

/** Ported from `responses/banner/banner.response.ts`. */

export const IBannerResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  backgroundColor: z.string().nullable().optional(),
  textColor: z.string().nullable().optional(),
  cta: z.string().nullable().optional(),
  ctaUrl: z.string().nullable().optional(),
  priority: z.number(),
  active: z.boolean(),
  startsAt: wireDateSchema,
  endsAt: wireDateSchema,
  impressions: z.number(),
  clicks: z.number(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type IBannerResponse = z.infer<typeof IBannerResponseSchema>;
