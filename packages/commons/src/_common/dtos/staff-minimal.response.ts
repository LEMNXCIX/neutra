import { z } from "zod";

export const IStaffMinimalResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});
export type IStaffMinimalResponse = z.infer<typeof IStaffMinimalResponseSchema>;
