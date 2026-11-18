import type { CheckRunResult, DoctorContext } from "../domain/check-result";
import {
    type CommandResult,
    type CommandRunner,
    runCommand,
} from "./command.adapter";

const AUDIT_TIMEOUT_MS = 120_000;

type JsonRecord = Record<string, unknown>;

interface AuditSummary {
    total: number;
    high: number;
    critical: number;
    nonBreakingFixes: number;
}

function asRecord(value: unknown): JsonRecord | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as JsonRecord;
}

function numberValue(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * `bun audit --json` emits a flat map of package name -> advisory records
 * carrying a `severity`, with no metadata block and no fixAvailable field.
 */
function parseBunAudit(root: JsonRecord): AuditSummary | null {
    let total = 0;
    let high = 0;
    let critical = 0;
    for (const advisories of Object.values(root)) {
        if (!Array.isArray(advisories)) return null;
        for (const advisory of advisories) {
            const record = asRecord(advisory);
            if (!record || typeof record.severity !== "string") return null;
            total += 1;
            if (record.severity === "high") high += 1;
            if (record.severity === "critical") critical += 1;
        }
    }
    // Bun does not expose fix availability, so no non-breaking fix can be
    // asserted: findings stay at the original "without a non-breaking fix"
    // severity instead of being silently downgraded or promoted.
    return { total, high, critical, nonBreakingFixes: 0 };
}

function parseNpmAudit(root: JsonRecord): AuditSummary | null {
    const metadata = asRecord(root.metadata);
    const counts = asRecord(metadata?.vulnerabilities);
    if (!counts) return null;

    const high = numberValue(counts.high) ?? 0;
    const critical = numberValue(counts.critical) ?? 0;
    const total =
        numberValue(counts.total) ??
        high +
            critical +
            (numberValue(counts.moderate) ?? 0) +
            (numberValue(counts.low) ?? 0) +
            (numberValue(counts.info) ?? 0);

    const entries = asRecord(root?.vulnerabilities) ?? {};
    let nonBreakingFixes = 0;
    for (const entry of Object.values(entries)) {
        const fix = asRecord(entry)?.fixAvailable;
        if (fix === true) {
            nonBreakingFixes += 1;
        } else if (asRecord(fix) && asRecord(fix)?.isSemVerMajor !== true) {
            nonBreakingFixes += 1;
        }
    }

    return { total, high, critical, nonBreakingFixes };
}

function parseAudit(output: string): AuditSummary | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(output) as unknown;
    } catch {
        return null;
    }
    const root = asRecord(parsed);
    if (!root) return null;
    if (root.metadata !== undefined || root.vulnerabilities !== undefined) {
        return parseNpmAudit(root);
    }
    return parseBunAudit(root);
}

function networkFailure(result: CommandResult): boolean {
    if (result.timedOut) return true;
    const code = result.errorCode?.toLowerCase() ?? "";
    if (
        [
            "enotfound",
            "eai_again",
            "etimedout",
            "econnrefused",
            "econnreset",
            "enetunreach",
            "ehostunreach",
        ].includes(code)
    ) {
        return true;
    }

    const output = `${result.stderr}\n${result.stdout}`.toLowerCase();
    return [
        "enotfound",
        "eai_again",
        "etimedout",
        "econnrefused",
        "econnreset",
        "enetunreach",
        "ehostunreach",
        "network is unreachable",
        "registry.npmjs.org",
        "offline",
    ].some((marker) => output.includes(marker));
}

function auditDetails(summary: AuditSummary): string[] {
    return [
        `total=${summary.total}`,
        `high=${summary.high}`,
        `critical=${summary.critical}`,
    ];
}

/** Run bun audit without ever exposing its payload or applying a fix. */
export function createNpmAuditCheck(
    runner: CommandRunner = runCommand,
): (context: DoctorContext) => Promise<CheckRunResult> {
    return async (context) => {
        try {
            const result = await runner("bun", ["audit", "--json"], {
                cwd: context.rootDir,
                timeoutMs: AUDIT_TIMEOUT_MS,
            });
            // A non-zero exit code is expected when advisories exist; only a
            // failure that prevents verification is blocking.
            if (networkFailure(result)) {
                return {
                    status: "FAIL",
                    message: "bun audit could not reach the registry (blocked)",
                };
            }

            const summary = parseAudit(result.stdout);
            if (!summary) {
                return {
                    status: "FAIL",
                    message: "bun audit output could not be verified (blocked)",
                };
            }
            if (summary.total === 0) {
                return {
                    status: "PASS",
                    message: "bun audit found no vulnerabilities",
                    details: auditDetails(summary),
                };
            }
            if (summary.nonBreakingFixes > 0) {
                return {
                    status: "FAIL",
                    message: "bun audit found fixable vulnerabilities",
                    details: auditDetails(summary),
                };
            }
            return {
                status: "WARN",
                message:
                    "bun audit found vulnerabilities without a non-breaking fix",
                details: auditDetails(summary),
            };
        } catch {
            return {
                status: "FAIL",
                message: "bun audit could not be executed (blocked)",
            };
        }
    };
}

export const checkNpmAudit = createNpmAuditCheck();
