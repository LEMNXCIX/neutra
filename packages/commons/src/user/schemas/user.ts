import { z } from "zod";
import {
  booleanQuerySchema,
  emailSchema,
} from "../../_common/dto-primitives.js";

/** Ported from `requests/user.request.ts`. */

/** The six admin-safe columns, matching the repository allowlist. */
export const UpdateUserDtoSchema = z.object({
  name: z.string().optional(),
  email: emailSchema.optional(),
  profilePic: z.string().optional(),
  phone: z.string().optional(),
  pushToken: z.string().optional(),
  active: booleanQuerySchema.optional(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserDtoSchema>;

export const AssignRoleDtoSchema = z.object({
  roleId: z.string().min(1),
});
export type AssignRoleDto = z.infer<typeof AssignRoleDtoSchema>;
