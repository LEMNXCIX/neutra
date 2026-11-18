/**
 * Final DoD gate for the phase-2 web integration (Task 8).
 *
 * Asserts the seven acceptance conditions from the phase-2 spec:
 *   1. apps/web exists with its preserved history (75d4d2d) and `name: web`;
 *   2. a single bun.lock at the root and no package-lock.json anywhere;
 *   3. apps/web consumes @neutra/commons via "workspace:*";
 *   4. both web guards (verify-web-contracts.mjs, verify-web-ci.mjs) PASS;
 *   5. the drift test imports ErrorCodes from @neutra/commons and contains no
 *      BACKEND_CODES literal;
 *   6. the monorepo working tree is clean;
 *   7. the phase-1 verify-dod.mjs gate still reports 7/7.
 *
 * Checks 6 and 7 intentionally depend on a committed tree: commit the phase-2
 * work before the final PASS re-run.
 *
 * Run from anywhere: every path is resolved relative to the monorepo root.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const WEB_HISTORY_SHA = "75d4d2d";
const DRIFT_TEST = join(root, "apps", "web", "src", "lib", "__tests__", "error-codes.test.ts");
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".jest-cache",
  ".output",
  ".git",
  "coverage",
  ".tanstack",
]);
const LOCKFILES = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function indent(text) {
  return text.trim().split("\n").join("\n        ");
}

function git(args, cwd = root) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/** Run a root-relative .mjs with the same Node that runs this verifier. */
function runNode(relPath) {
  try {
    const output = execFileSync(process.execPath, [join(root, relPath)], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    };
  }
}

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
    console.error(`  FAIL  ${name}\n        ${indent(error.message)}`);
  }
}

// 1. apps/web present, history preserved, name === "web".
check('apps/web exists with history (75d4d2d) and name "web"', () => {
  const pkgPath = join(root, "apps", "web", "package.json");
  assert(existsSync(pkgPath), "missing apps/web/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  assert(pkg.name === "web", `expected name === "web", got ${JSON.stringify(pkg.name)}`);

  const commits = git(["log", "--format=%H"]).trim().split("\n");
  assert(
    commits.some((hash) => hash.startsWith(WEB_HISTORY_SHA)),
    `git log does not contain web history commit ${WEB_HISTORY_SHA}`,
  );
});

// 2. One root bun.lock, no competing lockfiles.
check("single bun.lock at root; no package-lock.json", () => {
  assert(existsSync(join(root, "bun.lock")), "missing root bun.lock");

  const bunLocks = [];
  const nested = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const target = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.name === "bun.lock") bunLocks.push(relative(root, target));
      else if (LOCKFILES.includes(entry.name)) nested.push(relative(root, target));
    }
  }
  assert(
    bunLocks.length === 1 && bunLocks[0] === "bun.lock",
    `expected exactly one bun.lock at the root, found: ${bunLocks.join(", ") || "(none)"}`,
  );
  assert(nested.length === 0, `competing lockfiles found: ${nested.join(", ")}`);
});

// 3. Shared contracts consumed as a workspace package.
check('apps/web declares @neutra/commons: workspace:*', () => {
  const pkgPath = join(root, "apps", "web", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  const found = fields
    .map((field) => [field, pkg[field]?.["@neutra/commons"]])
    .filter(([, version]) => version !== undefined);
  assert(found.length > 0, "apps/web/package.json has no @neutra/commons dependency");
  for (const [field, version] of found) {
    assert(
      version === "workspace:*",
      `expected ${field}["@neutra/commons"] === "workspace:*", got ${JSON.stringify(version)}`,
    );
  }
});

// 4. Both phase-2 guards PASS.
check("verify-web-contracts.mjs and verify-web-ci.mjs PASS", () => {
  for (const script of [
    "scripts/verify-web-contracts.mjs",
    "scripts/verify-web-ci.mjs",
  ]) {
    const { ok, output } = runNode(script);
    assert(ok, `${script} failed:\n        ${indent(output)}`);
  }
});

// 5. Drift guard is really reattached to @neutra/commons.
check("drift test imports ErrorCodes from commons and has no BACKEND_CODES", () => {
  assert(existsSync(DRIFT_TEST), `missing drift test ${relative(root, DRIFT_TEST)}`);
  const text = readFileSync(DRIFT_TEST, "utf8");
  assert(
    /import\s*\{\s*ErrorCodes\s*\}\s*from\s*["']@neutra\/commons["']/.test(text),
    'drift test must import ErrorCodes from "@neutra/commons"',
  );
  assert(!text.includes("BACKEND_CODES"), "drift test must not contain BACKEND_CODES");
});

// 6. Clean monorepo working tree.
check("monorepo git status is clean", () => {
  const status = git(["status", "--porcelain"]);
  assert(status.trim() === "", `working tree is dirty:\n        ${indent(status)}`);
});

// 7. Phase-1 DoD gate still 7/7.
check("phase-1 verify-dod.mjs still 7/7", () => {
  const { ok, output } = runNode("scripts/verify-dod.mjs");
  assert(ok, `verify-dod.mjs failed:\n        ${indent(output)}`);
  assert(
    /7\/7 checks passed/.test(output),
    `expected 7/7 checks passed, got:\n        ${indent(output)}`,
  );
});

const failed = checks.filter((c) => !c.ok);
console.log(`\nverify-web-dod: ${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) {
  console.error(`FAIL: web DoD gate failed (${failed.length} check(s))`);
  process.exit(1);
}
console.log("PASS: web DoD gate succeeded");
