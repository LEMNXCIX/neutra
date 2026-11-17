import { z } from "zod";

/**
 * Shared Zod building blocks for the ported DTOs. Everything here is
 * isomorphic: no Node builtins, no Express, no class-validator.
 */

/**
 * class-transformer's `@Transform` / class-validator's `@IsIn(["true","false"])`
 * in `activeOnly` only accept the literal strings `"true"` and `"false"`.
 * Converting anything else (e.g. `"yes"`) must be left to `z.boolean()` so it
 * is rejected — unlike `z.coerce.boolean()`, which treats every non-empty
 * string as `true`.
 */
export function coerceBoolean(value: unknown): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

export const booleanQuerySchema = z.preprocess(coerceBoolean, z.boolean());

/** `@Matches(POSITIVE_INT)` fields (`page`, `limit`, `skip`, `take`). */
export const positiveIntQuerySchema = z.coerce.number().int().positive();

/** Matches class-validator's `@IsDateString()` (ISO 8601 date or date-time). */
const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

export const isoDateStringSchema = z.string().refine(
  (value) => ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)),
  { message: "Invalid ISO 8601 date string" },
);

/** `@IsDateString()` on a `Date | string` property keeps the wire string. */
export const dateOrStringSchema = z.union([z.date(), isoDateStringSchema]);

/** Response DTOs declare `Date` fields; accept ISO strings from JSON too. */
export const wireDateSchema = z.coerce.date();

export const emailSchema = z.string().email();

export const unknownRecordSchema = z.record(z.string(), z.unknown());

/** `@IsInt()` / `@IsNumber()` fields also accept string-encoded numbers. */
export const numericSchema = z.coerce.number();
export const integerSchema = z.coerce.number().int();
