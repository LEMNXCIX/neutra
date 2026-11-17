/**
 * Canonical path referenced by the migration plan; the executable suite lives
 * in `test/unit/validation-zod.test.ts` (jest.unit.config.cjs only discovers
 * `test/unit/**` and `test/architecture/**`). Re-exporting keeps this path valid
 * under the full jest run without duplicating the assertions.
 */
import "./unit/validation-zod.test";
