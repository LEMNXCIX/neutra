/**
 * Final DoD gate for the monorepo migration (Task 12).
 *
 * Asserts the seven acceptance conditions from the spec:
 *   1. a single bun.lock at the root, no package-lock.json in apps/* or packages/*;
 *   2. zero class-validator / class-transformer references in apps/api TypeScript
 *      source (docs and generated caches are not source);
 *   3. apps/api consumes @neutra/commons via "workspace:*";
 *   4. packages/commons/src stays isomorphic: no node:/Prisma/Express/alias imports;
 *   5. the five migration SHAs are present in git log;
 *   6. the monorepo working tree is clean;
 *   7. the frontend sibling repo is byte-for-byte at scripts/.frontend-baseline.txt.
 *
 * Run from anywhere: every path is resolved relative to the monorepo root.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const REQUIRED_SHAS = ["ed9dbe0", "96894cb", "4dbebd5", "b0ee708", "fcd2539"];
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".jest-cache",
  ".output",
  ".git",
  "coverage",
]);
const LOCKFILES = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function git(args, cwd = root) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/** Recursively collect files under `dir` matching `extensions`. */
function walk(dir, extensions, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const target = join(dir, entry.name);
    if (entry.isDirectory()) walk(target, extensions, out);
    else if (entry.isFile() && extensions.has(entry.name.slice(entry.name.lastIndexOf("."))))
      out.push(target);
  }
  return out;
}

/** Return `${file}:${line}:${text}` for every line of `files` matching `re`. */
function grep(files, re) {
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8").split(/\r?\n/);
    text.forEach((line, index) => {
      if (re.test(line)) hits.push(`${relative(root, file)}:${index + 1}:${line.trim()}`);
    });
  }
  return hits;
}

const checks = [];
function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
    console.error(`  FAIL  ${name}\n        ${error.message}`);
  }
}

// 1. Single lockfile.
check("single bun.lock; no package-lock.json in apps/* or packages/*", () => {
  assert(existsSync(join(root, "bun.lock")), "missing root bun.lock");
  // walk() filters by extension, so collect lockfiles by name explicitly.
  const nested = [];
  for (const workspace of ["apps", "packages"]) {
    const base = join(root, workspace);
    if (!existsSync(base)) continue;
    const stack = [base];
    while (stack.length) {
      const dir = stack.pop();
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const target = join(dir, entry.name);
        if (entry.isDirectory()) stack.push(target);
        else if (LOCKFILES.includes(entry.name)) nested.push(relative(root, target));
      }
    }
  }
  assert(nested.length === 0, `nested lockfiles found in workspaces: ${nested.join(", ")}`);

  const bunLocks = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const target = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.name === "bun.lock") bunLocks.push(relative(root, target));
    }
  }
  assert(
    bunLocks.length === 1 && bunLocks[0] === "bun.lock",
    `expected exactly one bun.lock at the root, found: ${bunLocks.join(", ") || "(none)"}`,
  );
});

// 2. No class-validator / class-transformer in apps/api TypeScript source.
check("0 class-validator|class-transformer in apps/api source", () => {
  const apiDir = join(root, "apps", "api");
  const sources = walk(apiDir, new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]));
  const hits = grep(sources, /class-validator|class-transformer/);
  assert(hits.length === 0, `found ${hits.length} reference(s):\n        ${hits.slice(0, 10).join("\n        ")}`);
});

// 3. @neutra/commons consumed as a workspace package.
check("apps/api declares @neutra/commons: workspace:*", () => {
  const pkgPath = join(root, "apps", "api", "package.json");
  assert(existsSync(pkgPath), "missing apps/api/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  const found = fields
    .map((field) => [field, pkg[field]?.["@neutra/commons"]])
    .filter(([, version]) => version !== undefined);
  assert(found.length > 0, "apps/api/package.json has no @neutra/commons dependency");
  for (const [field, version] of found) {
    assert(
      version === "workspace:*",
      `expected ${field}["@neutra/commons"] === "workspace:*", got ${JSON.stringify(version)}`,
    );
  }
});

// 4. packages/commons/src stays isomorphic.
check('0 node:|@prisma/client|from "express" in packages/commons/src', () => {
  const commonsSrc = join(root, "packages", "commons", "src");
  assert(existsSync(commonsSrc), "missing packages/commons/src");
  const sources = walk(commonsSrc, new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]));
  // Import-form patterns (from "node:...", from "express", from "@/...") avoid
  // false positives from prose comments such as "Avoids `node:crypto`".
  const hits = grep(sources, /from "node:|@prisma\/client|from "express"|from "@\//);
  assert(hits.length === 0, `found ${hits.length} import(s):\n        ${hits.slice(0, 10).join("\n        ")}`);
});

// 5. Migration history preserved.
check("git log contains the 5 required SHAs", () => {
  const commits = git(["log", "--format=%H"]).trim().split("\n");
  const missing = REQUIRED_SHAS.filter((sha) => !commits.some((hash) => hash.startsWith(sha)));
  assert(missing.length === 0, `missing commits: ${missing.join(", ")}`);
});

// 6. Clean monorepo working tree.
check("monorepo git status is clean", () => {
  const status = git(["status", "--porcelain"]);
  assert(status.trim() === "", `working tree is dirty:\n        ${status.trim().split("\n").join("\n        ")}`);
});

// 7. Frontend sibling repo untouched (baseline captured in Task 2).
check("neutra-frontend status matches scripts/.frontend-baseline.txt", () => {
  const baselinePath = join(root, "scripts", ".frontend-baseline.txt");
  assert(existsSync(baselinePath), "missing scripts/.frontend-baseline.txt (Task 2)");
  const baseline = readFileSync(baselinePath, "utf8").replace(/\r\n/g, "\n").trimEnd();
  const candidates = [
    join(root, "..", "neutra-frontend"),
    "/mnt/c/Users/leonardo/Repositories/neutra-frontend",
  ];
  const frontendDir = candidates.find((p) => existsSync(join(p, ".git")));
  assert(frontendDir, `frontend sibling repo not found in ${candidates.join(", ")}`);
  const actual = git(["-C", frontendDir, "status", "--porcelain"]).replace(/\r\n/g, "\n").trimEnd();
  assert(
    actual === baseline,
    `frontend status drifted from baseline.\n        expected: ${JSON.stringify(baseline)}\n        actual:   ${JSON.stringify(actual)}`,
  );
});

const failed = checks.filter((c) => !c.ok);
console.log(`\nverify-dod: ${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) {
  console.error(`FAIL: DoD gate failed (${failed.length} check(s))`);
  process.exit(1);
}
console.log("PASS: DoD gate succeeded");
