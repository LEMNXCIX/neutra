/**
 * The HTTP layer must have a single wire envelope: the one published by
 * `@neutra/commons`. The front may keep its own `ApiError` wrapper, but the
 * envelope shape and the error-code catalog are not front-local definitions.
 *
 * - a real response fixture (including nested `errors[].metadata` and an exact
 *   `meta`) parses with the commons schema and is accepted by `ApiError`;
 * - neither `backend-api.ts` nor `frontend-api.ts` redefines the envelope or an
 *   error detail locally;
 * - `error-messages.ts` keys its Spanish copy off the shared `ErrorCodes`
 *   catalog instead of repeating code literals.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ErrorCodes, standardResponseSchema } from "@neutra/commons";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-client";

const WEB = resolve(__dirname, "../../..");
const sourceOf = (relativePath: string): string =>
    readFileSync(resolve(WEB, relativePath), "utf8");

const fixture = {
    success: false,
    statusCode: 401,
    message: "Unauthorized",
    errors: [
        {
            code: ErrorCodes.INVALID_CREDENTIALS,
            message: "Invalid credentials",
            field: "email",
            domain: "auth",
            metadata: { nested: 1 },
        },
    ],
    meta: {
        traceId: "trace-fixture-1",
        timestamp: "2026-01-01T00:00:00.000Z",
    },
};

describe("shared envelope fixture", () => {
    it("parses with standardResponseSchema keeping nested error metadata and exact meta", () => {
        const parsed = standardResponseSchema.parse(fixture);

        expect(parsed.errors?.[0]?.metadata).toEqual({ nested: 1 });
        expect(parsed.meta).toEqual(fixture.meta);
    });

    it("is accepted by the front ApiError, preserving status, errors and traceId", () => {
        const parsed = standardResponseSchema.parse(fixture);
        const error = new ApiError(
            parsed.message,
            parsed.statusCode,
            parsed.errors,
            parsed.meta.traceId,
        );

        expect(error.statusCode).toBe(401);
        expect(error.errors).toEqual(parsed.errors);
        expect(error.traceId).toBe("trace-fixture-1");
    });
});

describe("a single envelope definition", () => {
    const expectNoLocalEnvelope = (relativePath: string): void => {
        const source = sourceOf(relativePath);
        expect(source).not.toMatch(/\binterface\s+StandardResponse\b/);
        expect(source).not.toMatch(/\binterface\s+ErrorDetail\b/);
    };

    it("backend-api.ts has no local StandardResponse/ErrorDetail interface", () => {
        expectNoLocalEnvelope("src/lib/backend-api.ts");
    });

    it("frontend-api.ts has no local StandardResponse/ErrorDetail interface", () => {
        expectNoLocalEnvelope("src/types/frontend-api.ts");
    });

    it("backend-api's ApiResponse reuses the commons envelope instead of an inline error shape", () => {
        const source = sourceOf("src/lib/backend-api.ts");
        expect(source).toMatch(/\bStandardResponse\b/);
        expect(source).not.toMatch(/errors\?:\s*Array<\{/);
    });
});

describe("error catalog comes from commons", () => {
    const source = sourceOf("src/lib/error-messages.ts");

    it("keys Spanish copy with computed ErrorCodes members", () => {
        expect(source).toContain("ErrorCodes");
        expect(source).toMatch(/\[ErrorCodes\.[A-Z_]+\]:/);
    });

    it("has no literal uppercase error-code keys left", () => {
        // Scope to CODE_MESSAGES: DOMAIN_MESSAGES legitimately has a bare
        // `RATE_LIMIT:` key (an underscore-containing domain fallback).
        const block = source.slice(
            source.indexOf("const CODE_MESSAGES"),
            source.indexOf("/** Last resort"),
        );
        const literalKeys = block.match(/^\s*[A-Z][A-Z0-9_]*:\s*["']/gm) ?? [];
        expect(
            literalKeys,
            `claves literales: ${literalKeys.join(", ")}`,
        ).toEqual([]);
    });
});
