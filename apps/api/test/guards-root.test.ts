import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

/** The guards are invoked exactly as CI and developers do: from the root. */
const MONOREPO_ROOT = resolve(__dirname, "../../..");

const RULE_NAMES = [
    "layerDirection",
    "entitiesAreTypes",
    "domainExists",
    "noDuplicatedRules",
    "noPresenters",
    "noHardcodedMoney",
    "noRequireInCore",
    "noHttpStatusInCore",
    "portsIgnoreHttpDtos",
    "authMiddlewareIsThin",
    "tenantMiddlewareIsThin",
] as const;

interface ScriptRun {
    status: number | null;
    output: string;
}

function runRootScript(
    script: string,
    extraArgs: readonly string[] = [],
): ScriptRun {
    const result = spawnSync("bun", ["run", script, ...extraArgs], {
        cwd: MONOREPO_ROOT,
        encoding: "utf8",
        env: { ...process.env },
        timeout: 180_000,
    });
    return {
        status: result.status,
        output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    };
}

describe("root-level architecture guards", () => {
    it("check:arch runs from the monorepo root and passes", () => {
        const { status, output } = runRootScript("check:arch");
        expect(status).toBe(0);
        expect(output).toContain(
            "PASSED: No architecture boundary violations.",
        );
    }, 180_000);

    it("doctor:api runs from the monorepo root and lists R1-R11 by name", () => {
        const { status, output } = runRootScript("doctor:api", [
            "--",
            "--rules",
            "architecture.rules",
        ]);
        expect(status).toBe(0);
        for (const name of RULE_NAMES) {
            expect(output).toContain(name);
        }
    }, 180_000);

    it("commons:check reports the workspace link and aligned zod majors", () => {
        const { status, output } = runRootScript("commons:check");
        expect(status).toBe(0);
        expect(output).toContain("workspace:*");
        expect(output).toContain("zod majors align");
    }, 180_000);
});
