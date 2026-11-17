import { z } from "zod";
import { dateOrStringSchema } from "../../_common/dto-primitives.js";
import { AppointmentStatusSchema } from "../../enums/index.js";

/** Ported from `requests/appointment.request.ts`. */

export const CreateAppointmentDtoSchema = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().min(1),
  startTime: dateOrStringSchema,
  userId: z.string().optional(),
  notes: z.string().optional(),
  couponCode: z.string().optional(),
});
export type CreateAppointmentDto = z.infer<typeof CreateAppointmentDtoSchema>;

export const CancelAppointmentDtoSchema = z.object({
  reason: z.string().optional(),
});
export type CancelAppointmentDto = z.infer<typeof CancelAppointmentDtoSchema>;

export const UpdateAppointmentStatusDtoSchema = z.object({
  status: AppointmentStatusSchema,
  reason: z.string().optional(),
});
export type UpdateAppointmentStatusDto = z.infer<
  typeof UpdateAppointmentStatusDtoSchema
>;
