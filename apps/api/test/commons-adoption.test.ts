/**
 * Canonical path from the migration brief. `jest.unit.config.cjs` only
 * discovers `test/unit/**` and `test/architecture/**`, so the executable suite
 * lives there; this shim keeps the brief's path valid under the full config
 * without duplicating the assertions.
 */
import "./unit/commons-adoption.test";
