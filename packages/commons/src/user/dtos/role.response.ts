import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";

/** Ported from `responses/role/role.response.ts`. */

export const IPermissionMinimalResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  active: z.boolean(),
});
export type IPermissionMinimalResponse = z.infer<
  typeof IPermissionMinimalResponseSchema
>;

export const IRoleResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  level: z.number(),
  active: z.boolean(),
  permissions: z.array(IPermissionMinimalResponseSchema).optional(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type IRoleResponse = z.infer<typeof IRoleResponseSchema>;
