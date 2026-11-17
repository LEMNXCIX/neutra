import { z } from "zod";
import { booleanQuerySchema } from "../../_common/dto-primitives.js";

/** Ported from `requests/permission.request.ts`. */

export const CreatePermissionDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  active: booleanQuerySchema.optional(),
});
export type CreatePermissionDto = z.infer<typeof CreatePermissionDtoSchema>;

export const UpdatePermissionDtoSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  active: booleanQuerySchema.optional(),
});
export type UpdatePermissionDto = z.infer<typeof UpdatePermissionDtoSchema>;
