import {
    ActiveOnlyQueryDtoSchema,
    LogListQueryDtoSchema,
    OrderListQueryDtoSchema,
    PagedQueryDtoSchema,
} from "@neutra/commons";
import type { ZodType } from "zod";

function errorsOf(schema: ZodType, input: object): string[] {
    const result = schema.safeParse(input);
    return result.success
        ? []
        : result.error.issues.map((i) => i.path.join("."));
}

describe("shared list query schemas", () => {
    test("PagedQueryDtoSchema rejects garbage and accepts positive integers", () => {
        expect(errorsOf(PagedQueryDtoSchema, { page: "abc" })).toEqual([
            "page",
        ]);
        expect(errorsOf(PagedQueryDtoSchema, { limit: "0" })).toEqual([
            "limit",
        ]);
        expect(
            errorsOf(PagedQueryDtoSchema, { page: "2", limit: "25" }),
        ).toEqual([]);
    });

    test("ActiveOnlyQueryDtoSchema only accepts literal booleans", () => {
        expect(errorsOf(ActiveOnlyQueryDtoSchema, { activeOnly: "1" })).toEqual(
            ["activeOnly"],
        );
        expect(
            errorsOf(ActiveOnlyQueryDtoSchema, { activeOnly: "false" }),
        ).toEqual([]);
    });

    test("OrderListQueryDtoSchema rejects malformed dates", () => {
        expect(
            errorsOf(OrderListQueryDtoSchema, { startDate: "not-a-date" }),
        ).toEqual(["startDate"]);
    });

    test("LogListQueryDtoSchema validates skip/take and dates", () => {
        expect(errorsOf(LogListQueryDtoSchema, { skip: "-1" })).toEqual([
            "skip",
        ]);
        expect(errorsOf(LogListQueryDtoSchema, { endDate: "garbage" })).toEqual(
            ["endDate"],
        );
    });
});
