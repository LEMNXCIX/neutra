import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";

/** Ported from `responses/user/user-public.response.ts`. */

export const IUserPublicResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  profilePic: z.string().nullable().optional(),
  active: z.boolean(),
  role: z
    .object({ id: z.string(), name: z.string(), level: z.number() })
    .optional(),
  tenant: z
    .object({ id: z.string(), name: z.string(), slug: z.string() })
    .optional(),
  createdAt: wireDateSchema.optional(),
  updatedAt: wireDateSchema.optional(),
});
export type IUserPublicResponse = z.infer<typeof IUserPublicResponseSchema>;
