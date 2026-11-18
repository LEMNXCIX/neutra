import { describe, expect, it } from "vitest";
import {
    AppointmentStatus,
    CategoryType,
    ErrorCodes,
    OrderStatus,
    TenantType,
    errorDetailSchema,
    responsePaginationSchema,
    standardResponseSchema,
    type StandardResponse,
} from "@/types/frontend-api";
import {
    AppointmentStatus as CommonsAppointmentStatus,
    CategoryType as CommonsCategoryType,
    ErrorCodes as CommonsErrorCodes,
    OrderStatus as CommonsOrderStatus,
    TenantType as CommonsTenantType,
} from "@neutra/commons";

describe("@neutra/commons is the SSOT for wire types re-exported by @/types/frontend-api", () => {
    it("(a) standardResponseSchema accepts an envelope with meta.traceId/timestamp and a numeric error metadata", () => {
        const parsed = standardResponseSchema.safeParse({
            success: false,
            statusCode: 400,
            message: "bad request",
            data: { id: "1" },
            errors: [{ code: "VALIDATION_ERROR", message: "invalid", metadata: 42 }],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
            meta: { traceId: "trace-123", timestamp: "2026-01-01T00:00:00.000Z" },
        });

        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.meta).toEqual({
                traceId: "trace-123",
                timestamp: "2026-01-01T00:00:00.000Z",
            });
            expect(parsed.data.errors?.[0]?.metadata).toBe(42);
        }
    });

    it("(a2) errorDetailSchema and responsePaginationSchema are the commons schemas", () => {
        expect(errorDetailSchema.safeParse({ code: "X", message: "y", metadata: 7 }).success).toBe(true);
        expect(responsePaginationSchema.safeParse({ total: 0, page: 1, limit: 10, totalPages: 0 }).success).toBe(true);
    });

    it("(b) the inferred StandardResponse type keeps ErrorDetail.metadata as unknown (no narrowing)", () => {
        const response = {
            success: false,
            statusCode: 400,
            message: "bad request",
            errors: [{ code: "X", message: "y", metadata: 42 }],
            meta: { traceId: "t", timestamp: "ts" },
        } satisfies StandardResponse<{ id: string }>;

        expect(response.errors?.[0]?.metadata).toBe(42);
    });

    it("(c) ErrorCodes.INVALID_CREDENTIALS maps to the AUTH wire value", () => {
        expect(ErrorCodes.INVALID_CREDENTIALS).toBe("AUTH_INVALID_CREDENTIALS");
        expect(ErrorCodes).toEqual(CommonsErrorCodes);
    });

    it("(d) re-exported enums carry exactly the commons values", () => {
        expect(AppointmentStatus).toEqual(CommonsAppointmentStatus);
        expect(TenantType).toEqual(CommonsTenantType);
        expect(OrderStatus).toEqual(CommonsOrderStatus);
        expect(CategoryType).toEqual(CommonsCategoryType);
    });
});
