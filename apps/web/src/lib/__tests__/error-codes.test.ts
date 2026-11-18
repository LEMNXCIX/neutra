/**
 * The backend publishes its error codes as `@neutra/commons`' `ErrorCodes` and
 * says they exist "for better error handling and client-side error display".
 * This test is the contract check: if a code is added to that shared catalog
 * and not translated here, it fails. There is no "sibling repo is absent" skip
 * path — the guard is real and always runs.
 */
import { ErrorCodes } from "@neutra/commons";
import { describe, expect, it } from "vitest";

import {
    errorMessageFrom,
    firstErrorCode,
    firstTranslatedError,
    resolutionFor,
    translateErrorDetail,
} from "@/lib/error-messages";
import { assertErrorCodeCoverage } from "../../../tests/helpers/error-coverage";

describe("error message translation", () => {
    it("translates the reported case: short password", () => {
        const message = translateErrorDetail({
            code: ErrorCodes.INVALID_FORMAT,
            message: "password must be longer than or equal to 8 characters",
            field: "password",
            domain: "validation",
        });

        expect(message).toContain("contraseña");
        expect(message).not.toContain("password must be");
    });

    it("translates staff-hours conflicts without the raw backend message", () => {
        const message = translateErrorDetail({
            code: "BUSINESS_STAFF_HOURS_CONFLICT",
            message:
                "Staff working hours include active ranges on closed business day",
        });

        expect(message).toContain("miembro del equipo");
        expect(message).toContain("cerrado");
        expect(message).not.toContain("Staff working hours");
    });

    it("never surfaces the backend message", () => {
        const raw = "password must be longer than or equal to 8 characters";
        const message = translateErrorDetail({
            code: ErrorCodes.INVALID_CREDENTIALS,
            message: raw,
            field: "password",
        });

        expect(message).not.toContain(raw);
        expect(message).not.toMatch(/must be/);
    });

    it("falls back by domain for a code it does not know", () => {
        const message = translateErrorDetail({
            code: "BUSINESS_SOMETHING_BRAND_NEW",
            message: "brand new backend rule",
        });

        expect(message).toBe("No pudimos completar la operación.");
        expect(message).not.toContain("brand new");
    });

    it("falls back safely for a malformed code", () => {
        expect(translateErrorDetail({ code: "", message: "x" })).toBe(
            "No pudimos completar la operación.",
        );
    });

    it("ignores details with no code", () => {
        expect(
            firstTranslatedError([{ message: "algo sin código" }]),
        ).toBeUndefined();
    });

    it("uses the caller fallback when there is nothing to translate", () => {
        expect(
            errorMessageFrom(new Error("boom"), "Error al iniciar sesión"),
        ).toBe("Error al iniciar sesión");
        expect(errorMessageFrom(undefined, "Error al iniciar sesión")).toBe(
            "Error al iniciar sesión",
        );
        expect(
            errorMessageFrom(
                { errors: [{ message: "sin code" }] },
                "Copia en español",
            ),
        ).toBe("Copia en español");
    });

    it("picks the first translatable detail from a list", () => {
        const message = firstTranslatedError([
            { code: "", message: "ignorame" },
            { code: ErrorCodes.TOKEN_EXPIRED, message: "token expired" },
        ]);

        expect(message).toContain("sesión expiró");
    });

    it("reads the code a caller may branch on from a thrown error", () => {
        // The shape an ApiError carries after a 422 from the backend.
        expect(
            firstErrorCode({
                errors: [
                    {
                        code: ErrorCodes.EMAIL_TAKEN_IN_OTHER_TENANT,
                        message: "email already belongs to another tenant",
                        domain: "auth",
                    },
                ],
            }),
        ).toBe("AUTH_EMAIL_TAKEN_IN_OTHER_TENANT");
    });

    it("skips details with no code when reading the first one", () => {
        expect(
            firstErrorCode({
                errors: [
                    { message: "sin code" },
                    {
                        code: ErrorCodes.EMAIL_TAKEN_IN_OTHER_TENANT,
                        message: "taken",
                    },
                ],
            }),
        ).toBe("AUTH_EMAIL_TAKEN_IN_OTHER_TENANT");
    });

    it("has no code to read for a non-object, a missing errors, or a non-array one", () => {
        expect(firstErrorCode("boom")).toBeUndefined();
        expect(firstErrorCode(null)).toBeUndefined();
        expect(firstErrorCode(new Error("boom"))).toBeUndefined();
        expect(firstErrorCode({})).toBeUndefined();
        expect(firstErrorCode({ errors: "not an array" })).toBeUndefined();
    });

    it("never treats the backend's raw message as a translatable code", () => {
        // The wire `message` can itself look like a code ("EMAIL_TAKEN"), but
        // only errors[].code is the stable contract the UI may branch on.
        expect(
            firstErrorCode({
                message: "EMAIL_TAKEN",
                errors: [{ message: "EMAIL_TAKEN" }],
            }),
        ).toBeUndefined();
    });
});

describe("coverage of the published backend codes", () => {
    // The catalog is the shared SSOT, not a file in a sibling checkout.
    const published = Object.values(ErrorCodes) as string[];

    it("every published code resolves to real Spanish copy", () => {
        const untranslated = published.filter(
            (code) => resolutionFor(code) === "none",
        );
        expect(
            untranslated,
            `códigos sin traducir: ${untranslated.join(", ")}`,
        ).toEqual([]);
    });

    it("assertErrorCodeCoverage accepts a map covering every published code", () => {
        // `resolutionFor` is the source of truth: a code resolves either to a
        // specific entry in CODE_MESSAGES or to its domain fallback. Any new
        // catalog code that resolves to "none" is absent from this map and the
        // guard throws, so the drift check cannot silently skip it.
        const translations: Record<string, string> = {};
        for (const code of published) {
            if (resolutionFor(code) !== "none") {
                translations[code] = translateErrorDetail({
                    code,
                    message: "raw backend text",
                });
            }
        }
        expect(() =>
            assertErrorCodeCoverage(published, translations),
        ).not.toThrow();
    });

    it("never renders the raw backend message", () => {
        for (const code of published) {
            expect(
                translateErrorDetail({ code, message: "raw backend text" }),
            ).not.toContain("raw backend text");
        }
    });

    it("reads a non-trivial number of codes", () => {
        expect(published.length).toBeGreaterThan(50);
    });

    it("reports how each resolution was reached", () => {
        expect(resolutionFor("AUTH_INVALID_CREDENTIALS")).toBe("specific");
        expect(resolutionFor("AUTH_SOMETHING_NEW")).toBe("domain");
        expect(resolutionFor("NEWDOMAIN_WHATEVER")).toBe("none");
        expect(resolutionFor("")).toBe("none");
    });

    it("covers the codes this module maps explicitly", () => {
        for (const code of [
            "AUTH_INVALID_CREDENTIALS",
            "VALIDATION_INVALID_FORMAT",
            "RESOURCE_ROUTE_NOT_FOUND",
            "TENANT_NOT_FOUND",
            "BUSINESS_INSUFFICIENT_STOCK",
            "BUSINESS_STAFF_HOURS_CONFLICT",
            "LOYALTY_TARGET_NOT_REACHED",
            "RATE_LIMIT_EXCEEDED",
        ]) {
            expect(resolutionFor(code)).toBe("specific");
        }
    });
});
