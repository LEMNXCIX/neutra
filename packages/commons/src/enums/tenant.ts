import { z } from "zod";

export const TenantTypeSchema = z.enum({
  STORE: "STORE",
  BOOKING: "BOOKING",
  HYBRID: "HYBRID",
});

export const TenantType = TenantTypeSchema.enum;
export type TenantType = z.infer<typeof TenantTypeSchema>;
