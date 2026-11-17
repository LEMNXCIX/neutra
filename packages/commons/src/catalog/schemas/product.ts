import { z } from "zod";
import {
  booleanQuerySchema,
  numericSchema,
} from "../../_common/dto-primitives.js";

/** Ported from `requests/product.request.ts`. */

/** `ownerId` is server-owned and deliberately absent from the wire body. */
export const CreateProductDtoSchema = z.object({
  name: z.string(),
  description: z.string(),
  image: z.string().optional(),
  price: numericSchema.min(0),
  stock: numericSchema.min(0).optional(),
  active: booleanQuerySchema.optional(),
  categoryIds: z.array(z.string()).optional(),
});
export type CreateProductDto = z.infer<typeof CreateProductDtoSchema>;

export const UpdateProductDtoSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  price: numericSchema.min(0).optional(),
  stock: numericSchema.min(0).optional(),
  active: booleanQuerySchema.optional(),
  categoryIds: z.array(z.string()).optional(),
});
export type UpdateProductDto = z.infer<typeof UpdateProductDtoSchema>;

export const SearchProductDtoSchema = z.object({
  name: z.string(),
});
export type SearchProductDto = z.infer<typeof SearchProductDtoSchema>;
