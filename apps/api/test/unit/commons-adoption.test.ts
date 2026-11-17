/**
 * Adoption guard: the API's wire contracts now come from `@neutra/commons`.
 * The asserted literals are the values the API has historically emitted, so
 * this test fails on a package that drifts from the API's published contract.
 */
import {
    AppointmentStatus,
    ErrorCodes,
    standardResponseSchema,
    TenantType,
} from "@neutra/commons";

describe("@neutra/commons adoption", () => {
    test("exposes the appointment/Tenant enum values used by the API", () => {
        expect(AppointmentStatus.PENDING).toBe("PENDING");
        expect(TenantType.STORE).toBe("STORE");
    });

    test("exposes the shared error catalog", () => {
        // The brief spells this `ErrorCodes.AUTH_INVALID_CREDENTIALS`, but the
        // catalog is keyed by enum member name: the wire value lives at
        // `INVALID_CREDENTIALS`. Assert both the key and the wire value.
        expect(ErrorCodes.INVALID_CREDENTIALS).toBe("AUTH_INVALID_CREDENTIALS");
        expect(Object.values(ErrorCodes)).toContain("AUTH_INVALID_CREDENTIALS");
    });

    test("standardResponseSchema validates the API response envelope", () => {
        const parsed = standardResponseSchema.parse({
            success: true,
            statusCode: 200,
            message: "OK",
            data: { id: "1" },
            meta: {
                traceId: "t-1",
                timestamp: "2026-01-01T00:00:00.000Z",
            },
        });
        expect(parsed.success).toBe(true);
        expect(parsed.data).toEqual({ id: "1" });
    });
});
