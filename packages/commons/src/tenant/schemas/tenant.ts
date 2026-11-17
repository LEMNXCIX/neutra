import { z } from "zod";
import { booleanQuerySchema, unknownRecordSchema } from "../../_common/dto-primitives.js";
import { TenantTypeSchema } from "../../enums/index.js";

/** Ported from `requests/tenant.dto.ts`. */

/** Same shape as the `TenantConfig` entity in `tenant/entities/tenant.ts`. */
export const TenantConfigSchema = z.object({
  branding: z
    .object({
      primaryColor: z.string().optional(),
      tenantLogo: z.string().optional(),
      favicon: z.string().optional(),
    })
    .optional(),
  settings: z
    .object({
      supportEmail: z.string().optional(),
      websiteUrl: z.string().optional(),
      currency: z.string().optional(),
      language: z.string().optional(),
      timezone: z.string().optional(),
      businessHours: unknownRecordSchema.optional(),
      holidays: z.array(z.string()).optional(),
    })
    .optional(),
  features: z.record(z.string(), z.boolean()).optional(),
});
export type TenantConfigInput = z.infer<typeof TenantConfigSchema>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateTenantDtoSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(SLUG).min(2).max(63),
  type: TenantTypeSchema,
  config: TenantConfigSchema.optional(),
});
export type CreateTenantDto = z.infer<typeof CreateTenantDtoSchema>;

export const UpdateTenantDtoSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z.string().regex(SLUG).max(63).optional(),
  type: TenantTypeSchema.optional(),
  config: TenantConfigSchema.partial().optional(),
  active: booleanQuerySchema.optional(),
});
export type UpdateTenantDto = z.infer<typeof UpdateTenantDtoSchema>;

export const UpdateTenantFeaturesDtoSchema = z.object({
  features: z.record(z.string(), z.boolean()),
});
export type UpdateTenantFeaturesDto = z.infer<
  typeof UpdateTenantFeaturesDtoSchema
>;

/** Interfaces from `requests/tenant.request.ts`, kept as inferred aliases. */
export type CreateTenantDTO = CreateTenantDto;
export type UpdateTenantDTO = UpdateTenantDto;
export type UpdateTenantFeaturesDTO = UpdateTenantFeaturesDto;
