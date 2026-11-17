import { z } from "zod";

export const IUserMinimalResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  profilePic: z.string().nullable().optional(),
});
export type IUserMinimalResponse = z.infer<typeof IUserMinimalResponseSchema>;
