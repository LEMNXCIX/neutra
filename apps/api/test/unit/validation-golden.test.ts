import fs from "node:fs";
import {
    GOLDEN_CASES,
    runCase,
    SNAPSHOT_PATH,
} from "@/scripts/record-validation-golden";

type GoldenEntry = { status: number; errors: unknown };

// Read at module load: while the snapshot has not been recorded this throws
// ENOENT, which is the intended RED state before `record-validation-golden.ts`
// is run against the untouched legacy validation middleware.
const snapshot: Record<string, GoldenEntry> = JSON.parse(
    fs.readFileSync(SNAPSHOT_PATH, "utf8"),
);

describe("validation golden responses (frozen legacy baseline)", () => {
    test("snapshot contains exactly one entry per matrix case", () => {
        expect(Object.keys(snapshot).sort()).toEqual(
            GOLDEN_CASES.map((testCase) => testCase.id).sort(),
        );
    });

    test.each(GOLDEN_CASES)("$id", async (testCase) => {
        const entry = snapshot[testCase.id];
        expect(entry).toBeDefined();

        const actual = await runCase(testCase);

        expect(actual.status).toBe(400);
        expect(entry.status).toBe(400);
        expect(actual.errors).toEqual(entry.errors);
    });
});
