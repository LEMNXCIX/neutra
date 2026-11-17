import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";
import {
  IServiceMinimalResponseSchema,
  IStaffMinimalResponseSchema,
  ITenantMinimalResponseSchema,
  IUserMinimalResponseSchema,
} from "../../_common/dtos/index.js";
import { AppointmentStatusSchema } from "../../enums/index.js";

/** Ported from `responses/appointment/appointment-list.response.ts`. */

export const IAppointmentListResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  startTime: wireDateSchema,
  endTime: wireDateSchema,
  status: AppointmentStatusSchema,
  statusChangedAt: wireDateSchema.nullable().optional(),
  statusChangeReason: z.string().nullable().optional(),
  statusChangedById: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  total: z.number(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
  user: IUserMinimalResponseSchema.optional(),
  staff: IStaffMinimalResponseSchema.optional(),
  service: IServiceMinimalResponseSchema.optional(),
  tenant: ITenantMinimalResponseSchema.optional(),
});
export type IAppointmentListResponse = z.infer<
  typeof IAppointmentListResponseSchema
>;
