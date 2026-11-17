import { z } from "zod";
import {
  booleanQuerySchema,
  integerSchema,
} from "../../_common/dto-primitives.js";

/** Ported from `requests/role.request.ts`. */

export const CreateRoleDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  level: integerSchema.min(0).optional(),
  active: booleanQuerySchema.optional(),
  permissionIds: z.array(z.string()).optional(),
});
export type CreateRoleDto = z.infer<typeof CreateRoleDtoSchema>;

export const UpdateRoleDtoSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  level: integerSchema.min(0).optional(),
  active: booleanQuerySchema.optional(),
  permissionIds: z.array(z.string()).optional(),
});
export type UpdateRoleDto = z.infer<typeof UpdateRoleDtoSchema>;
