import { z } from "zod";
import {
  booleanQuerySchema,
  integerSchema,
  numericSchema,
} from "../../_common/dto-primitives.js";

/** Ported from `requests/service.request.ts`. */

export const CreateServiceDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  duration: integerSchema.min(1),
  price: numericSchema.min(0),
  categoryId: z.string().optional(),
  active: booleanQuerySchema.optional(),
});
export type CreateServiceDto = z.infer<typeof CreateServiceDtoSchema>;

export const UpdateServiceDtoSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  duration: integerSchema.min(1).optional(),
  price: numericSchema.min(0).optional(),
  categoryId: z.string().optional(),
  active: booleanQuerySchema.optional(),
});
export type UpdateServiceDto = z.infer<typeof UpdateServiceDtoSchema>;
