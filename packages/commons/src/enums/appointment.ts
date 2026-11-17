import { z } from "zod";

/** Booking lifecycle. `PENDING` remains a value for API backwards compatibility. */
export const AppointmentStatusSchema = z.enum({
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  IN_PROGRESS: "IN_PROGRESS",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
});

export const AppointmentStatus = AppointmentStatusSchema.enum;
export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;
