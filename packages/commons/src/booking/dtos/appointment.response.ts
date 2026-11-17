import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";
import {
  IServiceMinimalResponseSchema,
  IStaffMinimalResponseSchema,
  IUserMinimalResponseSchema,
} from "../../_common/dtos/index.js";
import { AppointmentStatusSchema } from "../../enums/index.js";

/** Ported from `responses/appointment/appointment.response.ts`. */

export const IAppointmentResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  startTime: wireDateSchema,
  endTime: wireDateSchema,
  status: AppointmentStatusSchema,
  statusChangedAt: wireDateSchema.nullable().optional(),
  statusChangeReason: z.string().nullable().optional(),
  statusChangedById: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  discountAmount: z.number(),
  subtotal: z.number(),
  total: z.number(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
  user: IUserMinimalResponseSchema.optional(),
  staff: IStaffMinimalResponseSchema.optional(),
  service: IServiceMinimalResponseSchema.optional(),
});
export type IAppointmentResponse = z.infer<typeof IAppointmentResponseSchema>;
