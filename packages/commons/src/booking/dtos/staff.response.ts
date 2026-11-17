import { z } from "zod";
import {
  unknownRecordSchema,
  wireDateSchema,
} from "../../_common/dto-primitives.js";
import { ITenantMinimalResponseSchema } from "../../_common/dtos/index.js";

/** Ported from `responses/staff/staff.response.ts`. */

export const IStaffResponseSchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  active: z.boolean(),
  workingHours: unknownRecordSchema.nullable().optional(),
  serviceIds: z.array(z.string()).optional(),
  tenantId: z.string(),
  tenant: ITenantMinimalResponseSchema.optional(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type IStaffResponse = z.infer<typeof IStaffResponseSchema>;
