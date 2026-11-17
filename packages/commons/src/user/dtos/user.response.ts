import { z } from "zod";
import { IUserPublicResponseSchema } from "./user-public.response.js";

/** Ported from `responses/user/user.response.ts`. */

export const IUserResponseSchema = IUserPublicResponseSchema.extend({
  tenants: z
    .array(
      z.object({
        tenantId: z.string(),
        roleId: z.string(),
        role: z
          .object({ id: z.string(), name: z.string(), level: z.number() })
          .optional(),
        tenant: z
          .object({ id: z.string(), name: z.string(), slug: z.string() })
          .optional(),
      }),
    )
    .optional(),
});
export type IUserResponse = z.infer<typeof IUserResponseSchema>;
