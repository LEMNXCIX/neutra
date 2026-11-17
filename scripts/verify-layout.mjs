import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

let pkg;
try {
  pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
} catch (error) {
  console.error(`FAIL: no such file or package.json: ${error.message}`);
  process.exit(1);
}

assert(pkg.name === "neutra", `expected name === "neutra", got ${JSON.stringify(pkg.name)}`);
assert(
  Array.isArray(pkg.workspaces) &&
    pkg.workspaces.includes("apps/*") &&
    pkg.workspaces.includes("packages/*"),
  `workspaces must contain "apps/*" and "packages/*", got ${JSON.stringify(pkg.workspaces)}`,
);
assert(
  typeof pkg.packageManager === "string" && pkg.packageManager.startsWith("bun@"),
  `packageManager must start with "bun@", got ${JSON.stringify(pkg.packageManager)}`,
);

for (const file of [
  "apps/api/package.json",
  "apps/api/app.ts",
  "apps/api/tsconfig.json",
]) {
  assert(existsSync(join(root, file)), `missing ${file}`);
}

const log = execFileSync("git", ["log", "--format=%H"], {
  cwd: root,
  encoding: "utf8",
});
const commits = log.trim().split("\n");
for (const sha of ["ed9dbe0", "96894cb", "4dbebd5", "b0ee708", "fcd2539"]) {
  assert(
    commits.some((hash) => hash.startsWith(sha)),
    `git log does not contain commit ${sha}`,
  );
}

console.log("PASS: layout verification succeeded");
