import { existsSync, readFileSync, readdirSync } from "node:fs";
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

const webPkgPath = join(root, "apps/web/package.json");
let pkg;
try {
  pkg = JSON.parse(readFileSync(webPkgPath, "utf8"));
} catch (error) {
  console.error(`FAIL: no such file or package.json: ${error.message}`);
  process.exit(1);
}
assert(pkg.name === "web", `expected name === "web", got ${JSON.stringify(pkg.name)}`);

assert(
  !existsSync(join(root, "apps/web/package-lock.json")),
  "apps/web/package-lock.json must not exist",
);

const apiRoutesDir = join(root, "apps/web/src/routes/api");
let routeCount = 0;
try {
  routeCount = readdirSync(apiRoutesDir, { recursive: true }).filter(
    (entry) =>
      typeof entry === "string" &&
      (entry === "route.ts" || entry.endsWith("/route.ts")),
  ).length;
} catch (error) {
  console.error(`FAIL: cannot read ${apiRoutesDir}: ${error.message}`);
  process.exit(1);
}
assert(routeCount === 77, `expected 77 route.ts files under src/routes/api, got ${routeCount}`);

const log = execFileSync("git", ["log", "--format=%H"], {
  cwd: root,
  encoding: "utf8",
});
const commits = log.trim().split("\n");
for (const sha of ["75d4d2d", "84fd647", "26a4a12", "42406be"]) {
  assert(
    commits.some((hash) => hash.startsWith(sha)),
    `git log does not contain commit ${sha}`,
  );
}

console.log("PASS: web layout verification succeeded");
