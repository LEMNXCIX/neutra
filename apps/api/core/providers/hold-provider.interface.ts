/**
 * Generic short-lived resource hold port.
 *
 * Keys are canonical strings supplied by callers (e.g. from `@neutra/commons`
 * `holdKey`), so this port carries no appointment/product domain knowledge.
 */
export interface IHoldProvider {
    acquire(
        key: string,
        ownerId: string,
        ttlSeconds: number,
    ): Promise<{ key: string; expiresAt: Date }>;
    /** Returns false when the key is missing or owned by someone else. */
    release(key: string, ownerId: string): Promise<boolean>;
    /** Returns 0 for missing or expired keys, 1 for an active hold. */
    countActive(keys: string[]): Promise<Record<string, number>>;
}
