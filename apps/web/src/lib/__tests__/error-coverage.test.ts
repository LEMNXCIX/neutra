import { describe, expect, it } from "vitest";

import { assertErrorCodeCoverage } from "../../../tests/helpers/error-coverage";

describe("assertErrorCodeCoverage", () => {
    it("throws when a published code has no translation, naming the code", () => {
        expect(() =>
            assertErrorCodeCoverage(["AUTH_SYNTHETIC_CODE"], {}),
        ).toThrowError(/AUTH_SYNTHETIC_CODE/);
    });

    it("accepts a code set fully covered by the translations map", () => {
        expect(() =>
            assertErrorCodeCoverage(["SOME_CODE"], { SOME_CODE: "texto" }),
        ).not.toThrow();
    });
});
