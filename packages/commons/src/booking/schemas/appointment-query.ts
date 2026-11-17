import { z } from "zod";
import {
  isoDateStringSchema,
  positiveIntQuerySchema,
} from "../../_common/dto-primitives.js";

/** Ported from `requests/appointment.query.ts`. */

export const ListAppointmentsQueryDtoSchema = z.object({
  userId: z.string().optional(),
  staffId: z.string().optional(),
  serviceId: z.string().optional(),
  /** Kept as a string: `assertAppointmentStatus` owns the 422 contract. */
  status: z.string().optional(),
  startDate: isoDateStringSchema.optional(),
  endDate: isoDateStringSchema.optional(),
  page: positiveIntQuerySchema.optional(),
  limit: positiveIntQuerySchema.optional(),
});
export type ListAppointmentsQueryDto = z.infer<
  typeof ListAppointmentsQueryDtoSchema
>;

export const AttentionAppointmentsQueryDtoSchema = z.object({
  page: positiveIntQuerySchema.optional(),
  limit: positiveIntQuerySchema.optional(),
});
export type AttentionAppointmentsQueryDto = z.infer<
  typeof AttentionAppointmentsQueryDtoSchema
>;

export const AvailabilityQueryDtoSchema = z.object({
  staffId: z.string().min(1),
  serviceId: z.string().min(1),
  date: isoDateStringSchema,
  timezoneOffset: z.string().optional(),
});
export type AvailabilityQueryDto = z.infer<typeof AvailabilityQueryDtoSchema>;
