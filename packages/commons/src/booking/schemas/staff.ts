import { z } from "zod";
import {
  booleanQuerySchema,
  emailSchema,
  unknownRecordSchema,
} from "../../_common/dto-primitives.js";

/** Ported from `requests/staff.request.ts`. */

/** `@IsObject()`: day keys are open-ended, so only "is an object" is asserted. */
const workingHoursSchema = unknownRecordSchema;

export const CreateStaffDtoSchema = z.object({
  name: z.string().min(1),
  userId: z.string().optional(),
  email: emailSchema.optional(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
  bio: z.string().optional(),
  active: booleanQuerySchema.optional(),
  workingHours: workingHoursSchema.optional(),
});
export type CreateStaffDto = z.infer<typeof CreateStaffDtoSchema>;

export const UpdateStaffDtoSchema = z.object({
  userId: z.string().optional(),
  name: z.string().optional(),
  email: emailSchema.optional(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
  bio: z.string().optional(),
  active: booleanQuerySchema.optional(),
  workingHours: workingHoursSchema.optional(),
});
export type UpdateStaffDto = z.infer<typeof UpdateStaffDtoSchema>;

export const AssignStaffServiceDtoSchema = z.object({
  serviceId: z.string().min(1),
});
export type AssignStaffServiceDto = z.infer<typeof AssignStaffServiceDtoSchema>;

/** An empty list is meaningful: it means "detach every service". */
export const SyncStaffServicesDtoSchema = z.object({
  serviceIds: z.array(z.string()),
});
export type SyncStaffServicesDto = z.infer<typeof SyncStaffServicesDtoSchema>;
