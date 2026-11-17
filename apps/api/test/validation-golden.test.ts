/**
 * Canonical path referenced by the migration plan.
 *
 * The executable suite lives in `test/unit/validation-golden.test.ts` because
 * `jest.unit.config.cjs` only discovers `test/unit/**` and `test/architecture/**`;
 * re-exporting it here keeps this documented path valid under the full
 * (`jest.config.cjs`) run without duplicating the assertions.
 */
import "./unit/validation-golden.test";
