/**
 * Shared guard for the error-code drift check.
 *
 * Given the wire codes the client may receive and the translations it can
 * actually render, throw listing every code that has no entry. Keeping this in
 * a plain module (not a `*.test.ts`) lets the drift test and the CI verifiers
 * import it without depending on a test file.
 *
 * There is deliberately no "skip when the catalog is unavailable" path: a code
 * without copy is a failure, not a reason to weaken the check.
 */
export function assertErrorCodeCoverage(
    codes: string[],
    translations: Record<string, string>,
): void {
    const untranslated = codes.filter(
        (code) => !Object.hasOwn(translations, code),
    );

    if (untranslated.length > 0) {
        throw new Error(
            `códigos de error sin traducir (${untranslated.length}): ${untranslated.join(", ")}`,
        );
    }
}
