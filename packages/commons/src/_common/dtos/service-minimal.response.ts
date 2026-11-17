import { z } from "zod";

export const IServiceMinimalResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  duration: z.number(),
  price: z.number(),
});
export type IServiceMinimalResponse = z.infer<
  typeof IServiceMinimalResponseSchema
>;
