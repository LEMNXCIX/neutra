#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Fail if @neutra/commons is missing, unbuilt, or its zod major drifts from the API.
 *
 * Usage: bun run commons:check
 * Intended for local DX and CI before typecheck/test.
 */
const require = createRequire(import.meta.url);
// appRoot = <monorepo>/apps/api, so the workspace fallback below reaches
// <monorepo>/packages/commons regardless of the caller's cwd.
const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

function major(version) {
    const cleaned = String(version).replace(/^[\^~>=<\s]+/, "");
    const m = cleaned.match(/^(\d+)/);
    return m ? Number(m[1]) : null;
}

function fail(msg) {
    console.error(`✗ commons:check — ${msg}`);
    process.exit(1);
}

function ok(msg) {
    console.log(`✓ ${msg}`);
}

const apiPkg = readJson(join(appRoot, "package.json"));
const depSpec = apiPkg.dependencies?.["@neutra/commons"];
if (!depSpec) {
    fail("@neutra/commons is not listed in dependencies");
}
ok(`dependency spec: ${depSpec}`);

let commonsPkgPath;
try {
    commonsPkgPath = require.resolve("@neutra/commons/package.json");
} catch {
    const workspaceFallback = join(
        appRoot,
        "..",
        "..",
        "packages",
        "commons",
        "package.json",
    );
    if (existsSync(workspaceFallback)) {
        commonsPkgPath = workspaceFallback;
    } else {
        fail(
            "cannot resolve @neutra/commons — run bun install from the monorepo root (and build packages/commons if dist is missing)",
        );
    }
}

const commonsRoot = dirname(commonsPkgPath);
const commonsPkg = readJson(commonsPkgPath);
ok(`resolved ${commonsPkg.name}@${commonsPkg.version} → ${commonsRoot}`);

const distIndex = join(commonsRoot, "dist", "index.js");
const distTypes = join(commonsRoot, "dist", "index.d.ts");
if (!existsSync(distIndex) || !existsSync(distTypes)) {
    fail(
        `commons dist missing (expected dist/index.js + dist/index.d.ts under ${commonsRoot}). Run: bun run build --filter=@neutra/commons`,
    );
}
ok("commons dist present (index.js + index.d.ts)");

const apiZod = apiPkg.dependencies?.zod;
const commonsZod =
    commonsPkg.dependencies?.zod ?? commonsPkg.peerDependencies?.zod;
if (!apiZod || !commonsZod) {
    fail("zod version missing in api or commons package.json");
}

const apiMajor = major(apiZod);
const commonsMajor = major(commonsZod);
if (apiMajor === null || commonsMajor === null) {
    fail(`cannot parse zod majors (api=${apiZod}, commons=${commonsZod})`);
}
if (apiMajor !== commonsMajor) {
    fail(
        `zod major mismatch: api ${apiZod} (major ${apiMajor}) vs commons ${commonsZod} (major ${commonsMajor})`,
    );
}
ok(`zod majors align (api ${apiZod}, commons ${commonsZod})`);

// When published (not workspace/file), require a concrete semver range.
if (
    !String(depSpec).startsWith("workspace:") &&
    !String(depSpec).startsWith("file:") &&
    !/^\d|\^|~|>=/.test(String(depSpec))
) {
    fail(`published dependency should be a semver range, got: ${depSpec}`);
}
if (String(depSpec).startsWith("workspace:")) {
    ok("using workspace:* link (monorepo)");
} else if (String(depSpec).startsWith("file:")) {
    ok("using local file: link");
} else {
    ok(`using published range: ${depSpec}`);
}

console.log("✓ commons:check passed");
