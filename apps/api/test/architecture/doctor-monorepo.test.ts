import fs from "node:fs";
import path from "node:path";
import { createNpmAuditCheck } from "../../scripts/api-doctor/adapters/audit.adapter";
import type {
    CommandResult,
    CommandRunner,
} from "../../scripts/api-doctor/adapters/command.adapter";
import {
    checkNodeContract,
    checkPackageLock,
    nodeVersionSatisfiesMinimum,
} from "../../scripts/api-doctor/adapters/project.adapter";
import type { DoctorContext } from "../../scripts/api-doctor/domain/check-result";

const API_ROOT = path.resolve(__dirname, "../..");
const MONOREPO_ROOT = path.resolve(API_ROOT, "../..");

function ciContext(): DoctorContext {
    return {
        rootDir: API_ROOT,
        profile: "ci",
        includeIntegration: false,
        hasEnvKey: () => true,
    };
}

function commandResult(overrides: Partial<CommandResult> = {}): CommandResult {
    return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        stdout: "",
        stderr: "",
        errorCode: null,
        truncated: false,
        ...overrides,
    };
}

describe("doctor under the monorepo layout", () => {
    test("compares Node versions with semver >= instead of major equality", () => {
        const minimum = { major: 22, minor: 12, patch: 0 };

        expect(nodeVersionSatisfiesMinimum("v26.13.1", minimum)).toBe(true);
        expect(nodeVersionSatisfiesMinimum("v21.0.0", minimum)).toBe(false);
        expect(nodeVersionSatisfiesMinimum("v22.12.0", minimum)).toBe(true);
        expect(nodeVersionSatisfiesMinimum("v22.11.9", minimum)).toBe(false);
    });

    test("resolves CI.yml and bun.lock from the monorepo root", async () => {
        expect(
            fs.existsSync(path.join(MONOREPO_ROOT, ".github/workflows/CI.yml")),
        ).toBe(true);
        expect(fs.existsSync(path.join(MONOREPO_ROOT, "bun.lock"))).toBe(true);
        expect(fs.existsSync(path.join(API_ROOT, "package-lock.json"))).toBe(
            false,
        );

        const node = await checkNodeContract(ciContext());
        const lock = await checkPackageLock(ciContext());

        expect(node.status).toBe("PASS");
        expect(lock.status).toBe("PASS");
    });

    test("audit check shells out to bun audit --json, never npm audit", () => {
        const source = fs.readFileSync(
            path.join(API_ROOT, "scripts/api-doctor/adapters/audit.adapter.ts"),
            "utf8",
        );

        expect(source).toContain('"bun"');
        expect(source).toContain('"audit"');
        expect(source).toContain('"--json"');
        expect(source).not.toContain('"npm"');
        expect(source).not.toContain("npm audit");
    });

    test("parses the bun audit fixture and keeps the severity summary", async () => {
        // Shape captured from `bun audit --json` (bun 1.4.4): a flat map from
        // package name to an array of advisory records with a `severity`.
        const bunAuditOutput = JSON.stringify({
            "@hono/node-server": [
                {
                    id: 1243661,
                    url: "https://github.com/advisories/GHSA-rmxm-3fg6-px4f",
                    title: "second path decode",
                    severity: "moderate",
                },
            ],
            picomatch: [
                { id: 1247710, severity: "high" },
                { id: 9999999, severity: "critical" },
            ],
        });
        const runner: CommandRunner = async () =>
            commandResult({ exitCode: 1, stdout: bunAuditOutput });

        const result = await createNpmAuditCheck(runner)(ciContext());

        expect(result.status).toBe("WARN");
        expect(result.details).toEqual(["total=3", "high=1", "critical=1"]);
        expect(JSON.stringify(result)).not.toContain("picomatch");
    });

    test("blocks the audit check when the command cannot be verified", async () => {
        const failing: CommandRunner = async () =>
            commandResult({
                exitCode: 1,
                errorCode: "ENOTFOUND",
                stderr: "request to registry.npmjs.org failed",
            });

        const result = await createNpmAuditCheck(failing)(ciContext());

        expect(result.status).toBe("FAIL");
        expect(result.message).toMatch(/blocked/i);
    });
});
