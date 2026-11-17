import {
    ListAppointmentsQueryDtoSchema,
    ValidationErrorCodes,
} from "@neutra/commons";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
    validateDto,
    validateQueryDto,
} from "@/middleware/validation.middleware";

const ListQuery = z.object({
    search: z.string().optional(),
    page: z
        .string()
        .regex(/^[1-9]\d*$/)
        .optional(),
    limit: z
        .string()
        .regex(/^[1-9]\d*$/)
        .optional(),
});

describe("validateQueryDto", () => {
    function harness(query: Record<string, unknown>) {
        const req = { query } as unknown as Request;
        const res = {
            apiError: jest.fn().mockReturnThis(),
        } as unknown as Response;
        const next = jest.fn() as NextFunction;
        return { req, res, next };
    }

    test("exposes the validated query on req.validatedQuery", async () => {
        const { req, res, next } = harness({
            search: "coffee",
            page: "2",
            limit: "25",
        });

        await validateQueryDto(ListQuery)(req, res, next);

        expect(req.validatedQuery).toMatchObject({
            search: "coffee",
            page: "2",
            limit: "25",
        });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.apiError).not.toHaveBeenCalled();
    });

    // Documents the deliberate contract hardening on GET /api/appointments:
    // malformed pagination used to fall back silently, now it is a 400.
    test("the real list query schema rejects malformed pagination", async () => {
        const { req, res, next } = harness({ page: "abc" });

        await validateQueryDto(ListAppointmentsQueryDtoSchema)(req, res, next);

        expect(res.apiError).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ field: "page" }),
            ]),
            "Validación fallida",
            400,
        );
        expect(next).not.toHaveBeenCalled();
    });

    test("rejects garbage with a 400 without calling next", async () => {
        const { req, res, next } = harness({ limit: "abc" });

        await validateQueryDto(ListQuery)(req, res, next);

        expect(res.apiError).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    code: ValidationErrorCodes.INVALID_FORMAT,
                    field: "limit",
                }),
            ]),
            "Validación fallida",
            400,
        );
        expect(next).not.toHaveBeenCalled();
    });
});

describe("validateDto", () => {
    test("exposes the parsed body and calls next on success", async () => {
        const req = { body: { name: "EDITOR" } } as unknown as Request;
        const res = { apiError: jest.fn() } as unknown as Response;
        const next = jest.fn();

        await validateDto(z.object({ name: z.string() }))(req, res, next);

        expect(req.validatedBody).toEqual({ name: "EDITOR" });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.apiError).not.toHaveBeenCalled();
    });

    test("refuses a wrongly typed body with 400 before the handler runs", async () => {
        const req = { body: { name: 42 } } as unknown as Request;
        const res = { apiError: jest.fn() } as unknown as Response;
        const next = jest.fn();

        await validateDto(z.object({ name: z.string() }))(req, res, next);

        expect(res.apiError).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    code: ValidationErrorCodes.INVALID_FORMAT,
                    field: "name",
                }),
            ]),
            "Validación fallida",
            400,
        );
        expect(next).not.toHaveBeenCalled();
    });
});
