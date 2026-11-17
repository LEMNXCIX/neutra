import { describe, expect, it } from "bun:test";
import {
	ApiResponse,
	createErrorDetail,
	errorDetailSchema,
	responsePaginationSchema,
	standardResponseSchema,
} from "../_common";

describe("standard response envelope", () => {
	it("parses a fixture with meta and an error carrying object metadata", () => {
		const fixture = {
			success: false,
			statusCode: 422,
			message: "Validación fallida",
			errors: [
				{
					code: "VALIDATION_INVALID_EMAIL",
					message: "correo inválido",
					metadata: { nested: 1 },
				},
			],
			pagination: { total: 10, page: 1, limit: 5, totalPages: 2 },
			meta: { traceId: "uuid", timestamp: "2026-01-01T00:00:00.000Z" },
		};

		const result = standardResponseSchema.safeParse(fixture);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.meta.traceId).toBe("uuid");
			expect(
				(result.data.errors?.[0]?.metadata as { nested: number }).nested,
			).toBe(1);
		}
	});

	it("keeps metadata opaque: a number survives parse (unknown, not Record)", () => {
		const parsed = errorDetailSchema.parse({
			code: "SYSTEM_UNKNOWN_ERROR",
			message: "boom",
			metadata: 42,
		});
		expect(parsed.metadata).toBe(42);
	});

	it("rejects a response with no meta block", () => {
		const result = standardResponseSchema.safeParse({
			success: true,
			statusCode: 200,
			message: "OK",
			data: { id: 1 },
		});
		expect(result.success).toBe(false);
	});

	it("pagination schema requires all four fields", () => {
		expect(
			responsePaginationSchema.safeParse({
				total: 10,
				page: 1,
				limit: 5,
				totalPages: 2,
			}).success,
		).toBe(true);
		expect(
			responsePaginationSchema.safeParse({ total: 10, page: 1 }).success,
		).toBe(false);
	});

	it("ApiResponse helpers build envelopes that satisfy the schema", () => {
		expect(
			standardResponseSchema.safeParse(
				ApiResponse.success({ id: 1 }, "OK", 200, "t1"),
			).success,
		).toBe(true);
		expect(
			standardResponseSchema.safeParse(
				ApiResponse.error("bad", [], 400, "t2"),
			).success,
		).toBe(true);
		expect(createErrorDetail("X", "y", "field", 7).metadata).toBe(7);
	});
});
