import { PagedQueryDtoSchema, ValidationErrorCodes } from "@neutra/commons";
import type { NextFunction, Request, Response } from "express";
import {
    validateDto,
    validateQueryDto,
} from "@/middleware/validation.middleware";

/** The Zod rewrite keeps the same Express middleware contract, but on schemas. */
describe("validateQueryDto (Zod)", () => {
    function harness(query: Record<string, unknown>) {
        const req = { query } as unknown as Request;
        const res = {
            apiError: jest.fn().mockReturnThis(),
        } as unknown as Response;
        const next = jest.fn() as NextFunction;
        return { req, res, next };
    }

    test('coerces the "2" query string to the number 2 on req.validatedQuery', async () => {
        const { req, res, next } = harness({ page: "2" });

        await validateQueryDto(PagedQueryDtoSchema)(req, res, next);

        expect(req.validatedQuery).toMatchObject({ page: 2 });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.apiError).not.toHaveBeenCalled();
    });

    test("rejects a non-numeric page with a 400 VALIDATION_INVALID_FORMAT on field page", async () => {
        const { req, res, next } = harness({ page: "abc" });

        await validateQueryDto(PagedQueryDtoSchema)(req, res, next);

        expect(res.apiError).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    code: ValidationErrorCodes.INVALID_FORMAT,
                    field: "page",
                    domain: "validation",
                }),
            ]),
            "Validación fallida",
            400,
        );
        expect(next).not.toHaveBeenCalled();
    });
});

describe("validateDto (Zod)", () => {
    test("accepts a valid body and exposes the parsed value on req.validatedBody", async () => {
        const req = {
            body: { page: "3", limit: "10" },
        } as unknown as Request;
        const res = { apiError: jest.fn() } as unknown as Response;
        const next = jest.fn();

        await validateDto(PagedQueryDtoSchema)(req, res, next);

        expect(req.validatedBody).toEqual({ page: 3, limit: 10 });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.apiError).not.toHaveBeenCalled();
    });
});
