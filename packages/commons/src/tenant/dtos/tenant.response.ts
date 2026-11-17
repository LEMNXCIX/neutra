import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";
import { TenantTypeSchema } from "../../enums/index.js";
import { TenantConfigSchema } from "../schemas/tenant.js";

/** Ported from `responses/tenant/tenant.response.ts`. */

export const ITenantResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  type: TenantTypeSchema,
  config: TenantConfigSchema.optional(),
  active: z.boolean(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type ITenantResponse = z.infer<typeof ITenantResponseSchema>;
