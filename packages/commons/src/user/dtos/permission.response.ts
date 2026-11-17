import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";

/** Ported from `responses/permission/permission.response.ts`. */

export const IPermissionResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  active: z.boolean(),
  createdAt: wireDateSchema,
});
export type IPermissionResponse = z.infer<typeof IPermissionResponseSchema>;
