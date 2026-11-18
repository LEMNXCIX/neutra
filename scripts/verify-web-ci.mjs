/**
 * CI guard for the web workspace.
 *
 * The front is a first-class workspace: its typecheck, tests, production build
 * and a tenant-header smoke must run in CI alongside the API/CMS gates. This
 * script reads .github/workflows/CI.yml as text and fails fast with a precise
 * message when any of those gates is missing or mis-ordered.
 *
 * Two ordering invariants come from earlier tasks:
 *  - apps/web/tests/serve-start-static.test.ts resolves dist/client/icon.svg,
 *    which is gitignored. turbo's `test.dependsOn: ["^build"]` builds
 *    dependencies (commons) but NOT web itself, so the web build must be an
 *    explicit step before any test step.
 *  - @neutra/commons resolves to its gitignored dist/**, so commons must be
 *    built before the web typecheck/test steps.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const ciPath = join(root, ".github", "workflows", "CI.yml");
const ci = readFileSync(ciPath, "utf8");
const rootPkg = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
);

const failures = [];
const check = (ok, message) => {
    if (!ok) failures.push(message);
};

// --- Required steps -------------------------------------------------------
const REQUIRED_STEPS = [
    ["web typecheck", "bun run --cwd apps/web typecheck"],
    ["web test", "bun run --cwd apps/web test"],
    ["web build", "bun run --cwd apps/web build"],
];
for (const [label, command] of REQUIRED_STEPS) {
    check(
        ci.includes(command),
        `CI.yml is missing the ${label} step: \`${command}\``,
    );
}

// --- Tenant-header smoke --------------------------------------------------
check(
    /x-tenant-slug/.test(ci) && /x-tenant-id/.test(ci),
    "CI.yml smoke step must send both x-tenant-slug and x-tenant-id headers",
);
check(
    /\bcurl\b/.test(ci),
    "CI.yml smoke step must make an HTTP request (curl)",
);

// --- Forbidden patterns ---------------------------------------------------
check(
    !/\bnpm ci\b/.test(ci),
    "CI.yml must not use `npm ci` (single root bun.lock, installed with bun)",
);
check(
    !/\bcache\s*:\s*bun\b/.test(ci),
    "CI.yml must not use `cache: bun` (the Bun store is cached via actions/cache)",
);

// --- Untouched phase-1 gates ---------------------------------------------
check(
    (rootPkg.scripts?.build ?? "").includes("--filter=!neutra-cms"),
    "root build must keep excluding CMS (`--filter=!neutra-cms`)",
);
check(
    ci.includes(
        "bun run doctor:api -- --profile ci --include-integration --format text",
    ),
    "CI.yml doctor invocation must be exactly `bun run doctor:api -- --profile ci --include-integration --format text`",
);

// --- Build ordering (handoffs from Tasks 1 and 2) -------------------------
const webBuild = ci.indexOf("bun run --cwd apps/web build");
const commonsBuild = ci.indexOf("bun run --cwd packages/commons build");
const webTypecheck = ci.indexOf("bun run --cwd apps/web typecheck");
const webTest = ci.indexOf("bun run --cwd apps/web test");

check(
    commonsBuild !== -1 && commonsBuild < webBuild,
    "Build shared contracts (commons) must precede the web build",
);
check(
    webBuild !== -1 && webTest !== -1 && webBuild < webTest,
    "web build must precede web test (dist/client/icon.svg is gitignored)",
);
check(
    webBuild !== -1 && webTypecheck !== -1 && webBuild < webTypecheck,
    "web build must precede web typecheck",
);

if (failures.length > 0) {
    console.error(`FAIL: verify-web-ci found ${failures.length} problem(s):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
}

console.log(
    "PASS: verify-web-ci — web typecheck/test/build steps, tenant smoke, " +
        "bun-only install, CMS exclusion and build ordering all present",
);
