import { z } from "zod";

/**
 * Wire contract shared by the API and every front-end client.
 * Ported from `apps/api/types/api-response.ts` — the Zod schemas are the SSOT,
 * the TypeScript types are inferred from them.
 *
 * `AppError` and the HTTP-status resolvers deliberately stay in `apps/api`.
 */

/** Pagination block carried by every paginated standard response. */
export const responsePaginationSchema = z.object({
	total: z.number(),
	page: z.number(),
	limit: z.number(),
	totalPages: z.number(),
});

export type ResponsePagination = z.infer<typeof responsePaginationSchema>;

/**
 * A single error detail. `metadata` is intentionally `unknown` (not
 * `Record<string, unknown>`): it is serialized to the client and never
 * inspected by the server, so readers must narrow it before use.
 */
export const errorDetailSchema = z.object({
	code: z.string(),
	message: z.string(),
	field: z.string().optional(),
	domain: z.string().optional(),
	metadata: z.unknown().optional(),
});

export type ErrorDetail = z.infer<typeof errorDetailSchema>;

/** The envelope meta block is exactly traceId + timestamp — no index signature. */
const envelopeMetaSchema = z.object({
	traceId: z.string(),
	timestamp: z.string(),
});

/**
 * Base envelope schema. `data` is opaque here (Zod 4 has no native generics);
 * use `createStandardResponseSchema` to bind a concrete schema to it.
 */
export const standardResponseSchema = z.object({
	success: z.boolean(),
	statusCode: z.number(),
	message: z.string(),
	data: z.unknown().optional(),
	errors: z.array(errorDetailSchema).optional(),
	pagination: responsePaginationSchema.optional(),
	meta: envelopeMetaSchema,
});

export type StandardResponse<T = unknown> = Omit<
	z.infer<typeof standardResponseSchema>,
	"data"
> & { data?: T };

/** Bind a concrete Zod schema to the `data` slot of the envelope. */
export function createStandardResponseSchema<T extends z.ZodType>(
	dataSchema: T,
) {
	return standardResponseSchema.extend({ data: dataSchema });
}

/**
 * Isomorphic UUID v4 generator: a trace id only needs to be unique per
 * response, never cryptographically secure. Avoids `node:crypto` and any
 * external dependency so commons stays usable in the browser.
 */
function generateTraceId(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/** Construction helpers ported from the API response envelope. */
export class ApiResponse {
	static success<T>(
		data: T,
		message: string = "OK",
		statusCode: number = 200,
		traceId?: string,
	): StandardResponse<T> {
		return {
			success: true,
			statusCode,
			message,
			data,
			meta: {
				traceId: traceId || generateTraceId(),
				timestamp: new Date().toISOString(),
			},
		};
	}

	static error(
		message: string,
		errors: ErrorDetail[] = [],
		statusCode: number = 500,
		traceId?: string,
	): StandardResponse<null> {
		return {
			success: false,
			statusCode,
			message,
			errors,
			meta: {
				traceId: traceId || generateTraceId(),
				timestamp: new Date().toISOString(),
			},
		};
	}
}

/** Helper to create a standardized error detail. */
export function createErrorDetail(
	code: string,
	message: string,
	field?: string,
	metadata?: unknown,
): ErrorDetail {
	return {
		code,
		message,
		field,
		metadata,
	};
}
