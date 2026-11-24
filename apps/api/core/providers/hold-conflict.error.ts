/**
 * Raised when `SET NX` reports that another owner already holds the key.
 * Transport mapping (e.g. HTTP 409) belongs to the caller, not to this port.
 */
export class HoldConflictError extends Error {
    public readonly code = "HOLD_CONFLICT";

    public constructor(public readonly key: string) {
        super(`Hold already exists for key "${key}"`);
        this.name = this.constructor.name;
    }
}
