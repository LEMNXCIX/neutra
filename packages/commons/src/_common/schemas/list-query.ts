import { z } from "zod";
import {
  booleanQuerySchema,
  isoDateStringSchema,
  positiveIntQuerySchema,
} from "../dto-primitives.js";

/**
 * Query DTOs from `apps/api/core/application/dtos/requests/list-query.dto.ts`.
 *
 * The API declared `page`/`limit`/`skip`/`take` as strings and converted them
 * with `parsePagination`. Here Zod performs that coercion at the edge, so the
 * parsed value is already a number — this is the contract Task 8 relies on.
 */

export const PagedQueryDtoSchema = z.object({
  page: positiveIntQuerySchema.optional(),
  limit: positiveIntQuerySchema.optional(),
});
export type PagedQueryDto = z.infer<typeof PagedQueryDtoSchema>;

export const PagedSearchQueryDtoSchema = PagedQueryDtoSchema.extend({
  search: z.string().optional(),
});
export type PagedSearchQueryDto = z.infer<typeof PagedSearchQueryDtoSchema>;

export const CategoryListQueryDtoSchema = PagedQueryDtoSchema.extend({
  type: z.string().optional(),
});
export type CategoryListQueryDto = z.infer<typeof CategoryListQueryDtoSchema>;

export const CouponListQueryDtoSchema = PagedSearchQueryDtoSchema.extend({
  type: z.string().optional(),
  status: z.string().optional(),
});
export type CouponListQueryDto = z.infer<typeof CouponListQueryDtoSchema>;

export const DatedQueryDtoSchema = z.object({
  startDate: isoDateStringSchema.optional(),
  endDate: isoDateStringSchema.optional(),
});
export type DatedQueryDto = z.infer<typeof DatedQueryDtoSchema>;

export const OrderListQueryDtoSchema = PagedSearchQueryDtoSchema.extend({
  status: z.string().optional(),
  startDate: isoDateStringSchema.optional(),
  endDate: isoDateStringSchema.optional(),
});
export type OrderListQueryDto = z.infer<typeof OrderListQueryDtoSchema>;

export const OrderStatusQueryDtoSchema = z.object({
  status: z.string().optional(),
});
export type OrderStatusQueryDto = z.infer<typeof OrderStatusQueryDtoSchema>;

export const LogListQueryDtoSchema = DatedQueryDtoSchema.extend({
  level: z.string().optional(),
  tenantId: z.string().optional(),
  skip: positiveIntQuerySchema.optional(),
  take: positiveIntQuerySchema.optional(),
});
export type LogListQueryDto = z.infer<typeof LogListQueryDtoSchema>;

export const SimpleQueryDtoSchema = z.object({
  timeframe: z.string().optional(),
});
export type SimpleQueryDto = z.infer<typeof SimpleQueryDtoSchema>;

/** `activeOnly` is a literal boolean flag, never any truthy string. */
export const ActiveOnlyQueryDtoSchema = z.object({
  activeOnly: booleanQuerySchema.optional(),
});
export type ActiveOnlyQueryDto = z.infer<typeof ActiveOnlyQueryDtoSchema>;
