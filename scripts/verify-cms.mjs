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

const cmsDir = join(root, "apps", "cms");
const pkgPath = join(cmsDir, "package.json");

assert(existsSync(pkgPath), "missing apps/cms/package.json");

let pkg;
try {
  pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
} catch (error) {
  console.error(`FAIL: cannot parse apps/cms/package.json: ${error.message}`);
  process.exit(1);
}

// T11-b: the workspace is identified by the folder apps/cms, not the name field.
assert(
  pkg.name === "neutra-cms",
  `expected name === "neutra-cms", got ${JSON.stringify(pkg.name)}`,
);

// Single lockfile: the CMS npm lockfile is dropped in favour of the root bun.lock.
assert(
  !existsSync(join(cmsDir, "package-lock.json")),
  "apps/cms/package-lock.json must not exist (single root lockfile)",
);

// Full neutra-cms history must be an ancestor of HEAD.
const log = execFileSync("git", ["log", "--format=%H"], {
  cwd: root,
  encoding: "utf8",
});
const commits = log.trim().split("\n");
for (const sha of ["5678693", "be4a097"]) {
  assert(
    commits.some((hash) => hash.startsWith(sha)),
    `git log does not contain commit ${sha}`,
  );
}

// The in-flight (uncommitted in the source repo) dependency upgrade is preserved.
assert(
  pkg.dependencies?.["@strapi/strapi"] === "^5.57.0",
  `expected dependencies["@strapi/strapi"] === "^5.57.0", got ${JSON.stringify(pkg.dependencies?.["@strapi/strapi"])}`,
);
assert(
  pkg.devDependencies?.typescript === "^7.0.2",
  `expected devDependencies.typescript === "^7.0.2", got ${JSON.stringify(pkg.devDependencies?.typescript)}`,
);

console.log("PASS: CMS verification succeeded");
