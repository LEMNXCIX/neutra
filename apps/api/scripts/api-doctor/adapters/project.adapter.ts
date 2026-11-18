import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { CheckRunResult, DoctorContext } from "../domain/check-result";

type JsonRecord = Record<string, unknown>;

type JsonReadResult = { ok: true; value: unknown } | { ok: false };

function asRecord(value: unknown): JsonRecord | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as JsonRecord;
}

function readJson(filePath: string): JsonReadResult {
    try {
        return {
            ok: true,
            value: JSON.parse(readFileSync(filePath, "utf8")) as unknown,
        };
    } catch {
        return { ok: false };
    }
}

function readText(filePath: string): string | null {
    try {
        return readFileSync(filePath, "utf8");
    } catch {
        return null;
    }
}

/**
 * The doctor runs from apps/api, but CI.yml and bun.lock live at the monorepo
 * root. Start at resolve(rootDir, "..") and walk up until the shared file is
 * found, so the check does not depend on how deep the workspace is nested.
 */
function findFromMonorepo(rootDir: string, file: string): string | null {
    let current = resolve(rootDir, "..");
    while (true) {
        const candidate = join(current, file);
        if (existsSync(candidate)) return candidate;
        const parent = dirname(current);
        if (parent === current) return null;
        current = parent;
    }
}

/** Single-repo fixtures keep working through the fallback to rootDir. */
function resolveFromMonorepo(rootDir: string, file: string): string {
    return findFromMonorepo(rootDir, file) ?? join(rootDir, file);
}

/** Bun writes trailing commas into bun.lock; drop them outside string values. */
function parseBunLock(content: string): unknown {
    let cleaned = "";
    let inString = false;
    let escaped = false;
    for (let index = 0; index < content.length; index += 1) {
        const char = content[index];
        if (inString) {
            cleaned += char;
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') {
            inString = true;
            cleaned += char;
            continue;
        }
        if (char === ",") {
            let next = index + 1;
            while (next < content.length && /\s/.test(content[next])) {
                next += 1;
            }
            if (content[next] === "}" || content[next] === "]") continue;
        }
        cleaned += char;
    }
    return JSON.parse(cleaned) as unknown;
}

function pass(message: string, details?: string[]): CheckRunResult {
    return {
        status: "PASS",
        message,
        ...(details === undefined ? {} : { details }),
    };
}

function fail(message: string, details?: string[]): CheckRunResult {
    return {
        status: "FAIL",
        message,
        ...(details === undefined ? {} : { details }),
    };
}

export interface NodeMinimumVersion {
    major: number;
    minor: number;
    patch: number;
}

function versionFromMatch(match: RegExpMatchArray): NodeMinimumVersion | null {
    const major = Number(match[1]);
    const minor = Number(match[2] ?? 0);
    const patch = Number(match[3] ?? 0);
    if (
        !Number.isInteger(major) ||
        !Number.isInteger(minor) ||
        !Number.isInteger(patch)
    ) {
        return null;
    }
    return { major, minor, patch };
}

export function parseNodeMinimum(value: unknown): NodeMinimumVersion | null {
    if (typeof value !== "string") return null;
    const match = value.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    return match ? versionFromMatch(match) : null;
}

function parseActualVersion(value: string): NodeMinimumVersion | null {
    const match = value.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    return match ? versionFromMatch(match) : null;
}

export function nodeVersionSatisfiesMinimum(
    actual: string,
    minimum: NodeMinimumVersion,
): boolean {
    const version = parseActualVersion(actual);
    if (!version) return false;
    if (version.major !== minimum.major) {
        return version.major > minimum.major;
    }
    if (version.minor !== minimum.minor) {
        return version.minor > minimum.minor;
    }
    return version.patch >= minimum.patch;
}

function uniqueMajors(values: readonly number[]): number[] {
    return [...new Set(values)];
}

function dockerMajors(content: string): number[] {
    return uniqueMajors(
        [...content.matchAll(/^FROM\s+node:(\d+)(?:[-.\s]|$)/gim)].map(
            (match) => Number(match[1]),
        ),
    );
}

function ciNodeMajors(content: string): number[] {
    return uniqueMajors(
        [
            ...content.matchAll(
                /^\s*node-version:\s*["']?(\d+)(?:\.x|\.\*)?["']?\s*$/gim,
            ),
        ].map((match) => Number(match[1])),
    );
}

function appEngineMajors(content: string): number[] {
    return uniqueMajors(
        [...content.matchAll(/^\s*runtime:\s*nodejs(\d+)\s*$/gim)].map(
            (match) => Number(match[1]),
        ),
    );
}

function stableJson(value: unknown): string | null {
    if (value === undefined) return null;
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value) ?? "null";
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableJson(item) ?? "null").join(",")}]`;
    }
    const record = value as JsonRecord;
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
        .join(",")}}`;
}

function dependencyMap(value: unknown): string | null {
    const record = asRecord(value);
    return record ? stableJson(record) : null;
}

/** Compare the canonical major declared by package.json with every runtime declaration. */
export async function checkNodeContract(
    context: DoctorContext,
): Promise<CheckRunResult> {
    const packageData = readJson(join(context.rootDir, "package.json"));
    const packageRecord = packageData.ok ? asRecord(packageData.value) : null;
    const engines = asRecord(packageRecord?.engines);
    const minimum = parseNodeMinimum(engines?.node);
    const expectedMajor = minimum?.major ?? null;
    if (!packageRecord || minimum === null) {
        return fail(
            "Node runtime contract could not be read from package.json",
        );
    }

    const mismatches: string[] = [];
    if (!nodeVersionSatisfiesMinimum(process.versions.node, minimum)) {
        mismatches.push(
            "actual Node version does not satisfy package.json engines",
        );
    }

    const declarations: Array<{
        label: string;
        file: string;
        extract: (content: string) => number[];
        atMonorepoRoot?: boolean;
    }> = [
        {
            label: "Dockerfile.dev",
            file: "Dockerfile.dev",
            extract: dockerMajors,
        },
        {
            label: "Dockerfile.prod",
            file: "Dockerfile.prod",
            extract: dockerMajors,
        },
        {
            label: "CI.yml",
            file: ".github/workflows/CI.yml",
            extract: ciNodeMajors,
            atMonorepoRoot: true,
        },
        {
            label: "app.yaml",
            file: "app.yaml",
            extract: appEngineMajors,
        },
    ];

    for (const declaration of declarations) {
        const filePath = declaration.atMonorepoRoot
            ? resolveFromMonorepo(context.rootDir, declaration.file)
            : join(context.rootDir, declaration.file);
        const content = readText(filePath);
        if (content === null) {
            mismatches.push(`${declaration.label} could not be read`);
            continue;
        }
        const majors = declaration.extract(content);
        if (
            majors.length === 0 ||
            majors.some((major) => major !== expectedMajor)
        ) {
            mismatches.push(`${declaration.label} major mismatch`);
        }
    }

    return mismatches.length === 0
        ? pass("Node runtime contract is consistent")
        : fail("Node runtime contract is inconsistent", mismatches);
}

const LOCK_METADATA_FIELDS = ["name", "version", "license", "engines"];
const LOCK_DEPENDENCY_FIELDS = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
];

function compareMetadata(
    packageRecord: JsonRecord,
    lockRoot: JsonRecord,
    skipMissing: boolean,
): CheckRunResult {
    const mismatches: string[] = [];
    for (const field of LOCK_METADATA_FIELDS) {
        if (skipMissing && lockRoot[field] === undefined) continue;
        if (stableJson(packageRecord[field]) !== stableJson(lockRoot[field])) {
            mismatches.push(`${field} metadata mismatch`);
        }
    }
    for (const field of LOCK_DEPENDENCY_FIELDS) {
        if (skipMissing && lockRoot[field] === undefined) continue;
        if (
            dependencyMap(packageRecord[field]) !==
            dependencyMap(lockRoot[field])
        ) {
            mismatches.push(`${field} map mismatch`);
        }
    }

    return mismatches.length === 0
        ? pass("Package and lockfile metadata are consistent")
        : fail("Package and lockfile metadata are inconsistent", mismatches);
}

function compareBunLock(
    packageRecord: JsonRecord,
    rootDir: string,
    lockRootDir: string,
    content: string,
): CheckRunResult {
    let parsed: unknown;
    try {
        parsed = parseBunLock(content);
    } catch {
        return fail("Bun lockfile root metadata could not be read");
    }
    const lockRecord = asRecord(parsed);
    const workspaces = lockRecord ? asRecord(lockRecord.workspaces) : null;
    if (!workspaces) {
        return fail("Bun lockfile workspaces could not be read");
    }

    const workspacePath = relative(lockRootDir, rootDir)
        .split(/[\\/]/)
        .join("/");
    const workspace = asRecord(workspaces[workspacePath]);
    if (!workspace) {
        return fail("Bun lockfile has no entry for this workspace");
    }

    // bun.lock does not record license or engines for a workspace, so only
    // compare the fields it actually stores instead of demanding equality
    // against absent values.
    return compareMetadata(packageRecord, workspace, true);
}

/** Compare package.json with the lockfile root metadata and dependency maps. */
export async function checkPackageLock(
    context: DoctorContext,
): Promise<CheckRunResult> {
    const packageData = readJson(join(context.rootDir, "package.json"));
    const packageRecord = packageData.ok ? asRecord(packageData.value) : null;
    if (!packageRecord) {
        return fail("Package and lockfile root metadata could not be read");
    }

    const bunLockPath = findFromMonorepo(context.rootDir, "bun.lock");
    if (bunLockPath !== null) {
        const bunLock = readText(bunLockPath);
        if (bunLock !== null) {
            return compareBunLock(
                packageRecord,
                context.rootDir,
                dirname(bunLockPath),
                bunLock,
            );
        }
    }

    const lockData = readJson(join(context.rootDir, "package-lock.json"));
    const lockRecord = lockData.ok ? asRecord(lockData.value) : null;
    const packages = lockRecord ? asRecord(lockRecord.packages) : null;
    const root = packages ? asRecord(packages[""]) : null;
    if (!root) {
        return fail("Package and lockfile root metadata could not be read");
    }
    return compareMetadata(packageRecord, root, false);
}

/** Check only key presence; environment values are never read or returned. */
export async function checkRequiredEnvironment(
    context: DoctorContext,
): Promise<CheckRunResult> {
    const missing: string[] = [];
    try {
        const hasDatabaseUrl = context.hasEnvKey("DATABASE_URL");
        const hasLegacyDatabase =
            ["DB_USERNAME", "DB_PASSWORD", "DB_HOST"].every((key) =>
                context.hasEnvKey(key),
            ) && context.hasEnvKey("DB_NAME");

        if (!hasDatabaseUrl && !hasLegacyDatabase) {
            missing.push("DATABASE_URL or complete DB_* configuration");
        }
        for (const key of ["JWT_SECRET", "SESSION_SECRET"]) {
            if (!context.hasEnvKey(key)) missing.push(key);
        }
        if (context.profile === "full") {
            for (const key of ["REDIS_HOST", "REDIS_PORT"]) {
                if (!context.hasEnvKey(key)) missing.push(key);
            }
            for (const key of ["POSTGRES_USER", "POSTGRES_PASSWORD"]) {
                if (!context.hasEnvKey(key)) missing.push(key);
            }
        }
    } catch {
        return fail("Environment key presence could not be checked");
    }

    if (missing.length === 0) {
        return pass("Required environment keys are present");
    }
    return {
        status: context.profile === "default" ? "WARN" : "FAIL",
        message: "Required environment keys are missing",
        details: missing,
    };
}

export const checkEnvironmentPresence = checkRequiredEnvironment;
