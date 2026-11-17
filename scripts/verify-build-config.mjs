/**
 * Verifies that CI, Docker and the build configuration are parametrized for
 * the monorepo root (Task 10).
 *
 * Note (ruling T10-a): the API build script ends with `tsc && verify --rewrite`
 * and the 50 pre-existing TS2345 controller errors make tsc exit non-zero, so
 * `bun run build` as a whole is expected to exit 1. This check therefore only
 * asserts that the build EMITS apps/api/dist/app.js -- never that it exits 0.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

// --- Root CI workflow -------------------------------------------------------
const ciPath = ".github/workflows/CI.yml";
assert(existsSync(join(root, ciPath)), `missing ${ciPath} (workflow must live at repo root)`);

const ci = read(ciPath);
assert(ci.includes("bun install --frozen-lockfile"), `${ciPath} must contain 'bun install --frozen-lockfile'`);
assert(ci.includes("setup-bun"), `${ciPath} must contain setup-bun`);
// setup-node only accepts cache: npm|yarn|pnpm -- 'cache: bun' is invalid.
// The Bun store must be cached explicitly with actions/cache instead (model
// repo pattern), keyed on the single root bun.lock.
assert(!ci.includes("cache: bun"), `${ciPath} must not contain the invalid 'cache: bun' setup-node input`);
assert(ci.includes("path: ~/.bun/install/cache"), `${ciPath} must cache the Bun store (path: ~/.bun/install/cache)`);
assert(
  ci.includes("key: bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}"),
  `${ciPath} must key the Bun store cache on bun.lock`,
);
assert(!ci.includes("npm ci"), `${ciPath} must not contain 'npm ci'`);
assert(!/\bnpm run\b/.test(ci), `${ciPath} must not contain 'npm run'`);

// Prisma steps must go through the api workspace (or a turbo api filter).
assert(
  /bun run --cwd apps\/api prisma|turbo run .*--filter=?\s*api|--filter=api/.test(ci),
  `${ciPath} must run Prisma via 'bun run --cwd apps/api ...' or a turbo '--filter=api'`,
);
assert(!/\bnpx prisma\b/.test(ci), `${ciPath} must not contain 'npx prisma'`);

// Guard steps, in order.
assert(ci.includes("commons:check"), `${ciPath} must run the root 'commons:check' script`);
assert(ci.includes("check:arch"), `${ciPath} must run the root 'check:arch' script`);
assert(ci.includes("doctor:api"), `${ciPath} must run the root 'doctor:api' script`);

// Order is checked on actual `run:` commands, not prose in comments.
const runCommands = [...ci.matchAll(/^\s*run:\s*(.+)$/gm)].map((m) => m[1].trim());
const runIndexOf = (needle) => runCommands.findIndex((command) => command === needle);
const commonsIndex = runIndexOf("bun run commons:check");
assert(commonsIndex >= 0, `${ciPath} must have a 'bun run commons:check' step`);
for (const later of ["bun run typecheck", "bun run test"]) {
  const index = runIndexOf(later);
  assert(index >= 0, `${ciPath} must have a '${later}' step`);
  assert(commonsIndex < index, `commons:check must run before ${later} in ${ciPath}`);
}

// Services, env and Jest cache path are unchanged (only the lockfile hash key
// moves from package-lock.json to bun.lock).
assert(ci.includes("postgres:16-alpine"), `${ciPath} must keep the postgres service`);
assert(ci.includes("redis:7-alpine"), `${ciPath} must keep the redis service`);
assert(ci.includes("DATABASE_URL: postgresql://ci:ci@localhost:5432/ci"), `${ciPath} must keep the CI DATABASE_URL`);
assert(ci.includes(".jest-cache"), `${ciPath} must keep the '.jest-cache' cache path`);
assert(!ci.includes("package-lock.json"), `${ciPath} must not reference package-lock.json`);

// --- Single lockfile (ruling T10-b) ----------------------------------------
assert(!existsSync(join(root, "apps/api/package-lock.json")), "apps/api/package-lock.json must be removed (only root bun.lock remains)");
assert(existsSync(join(root, "bun.lock")), "missing root bun.lock");

// --- Docker -----------------------------------------------------------------
assert(existsSync(join(root, "apps/api/Dockerfile.prod")), "missing apps/api/Dockerfile.prod");
assert(existsSync(join(root, "apps/api/Dockerfile.dev")), "missing apps/api/Dockerfile.dev");

const composeFiles = {
  "apps/api/docker-compose.yml": "apps/api/Dockerfile.dev",
  "apps/api/docker-compose.prod.yml": "apps/api/Dockerfile.prod",
  "apps/api/docker-compose.debug.yml": "apps/api/Dockerfile.dev",
};
for (const [composePath, dockerfile] of Object.entries(composeFiles)) {
  const compose = read(composePath);
  assert(compose.includes("context: ../../"), `${composePath} must use the monorepo root as build context (context: ../../)`);
  assert(compose.includes(`dockerfile: ${dockerfile}`), `${composePath} must reference ${dockerfile} under apps/api`);
}

// Documented slot for the cms service (implemented in Task 11).
assert(
  read("apps/api/docker-compose.yml").includes("cms") &&
    read("apps/api/docker-compose.prod.yml").includes("cms"),
  "compose files must leave a documented slot for the cms service (Task 11)",
);

// --- Root .dockerignore (review fix C3) --------------------------------------
// Docker reads .dockerignore from the build-context root, which is the
// monorepo root for every API Dockerfile. The old apps/api/.dockerignore was
// inert and has been removed.
assert(existsSync(join(root, ".dockerignore")), "missing root .dockerignore (API build context is the monorepo root)");
const rootDockerIgnore = read(".dockerignore");
for (const pattern of [".env", "node_modules", "dist", ".git", ".turbo", ".jest-cache", "coverage"]) {
  assert(rootDockerIgnore.includes(pattern), `root .dockerignore must exclude ${pattern}`);
}
assert(existsSync(join(root, "apps/cms/.dockerignore")), "missing apps/cms/.dockerignore (cms context is apps/cms)");

// --- Root build excludes the CMS (review fix I1) -----------------------------
const rootPkg = JSON.parse(read("package.json"));
assert(
  (rootPkg.scripts?.build ?? "").includes("--filter=!neutra-cms"),
  "root build script must exclude neutra-cms (strapi build is separate and env-dependent)",
);

// --- Docker runtime is Node 22; prod deps are production-only (I2/I4) --------
const prodDocker = read("apps/api/Dockerfile.prod");
assert(/FROM node:22-/.test(prodDocker), "Dockerfile.prod runner must use a node:22-* image (D3)");
assert(prodDocker.includes('CMD ["node", "dist/app.js"]'), "Dockerfile.prod must run node dist/app.js");
assert(prodDocker.includes("bun install --production"), "Dockerfile.prod must install production-only dependencies (I4)");
assert(/FROM node:22-/.test(read("apps/api/Dockerfile.dev")), "Dockerfile.dev must use a node:22-* runtime (D3)");

// --- Build emits the production artifact (ruling T10-a) --------------------
const distDir = join(root, "apps/api/dist");
const appJs = join(distDir, "app.js");
rmSync(distDir, { recursive: true, force: true });
const build = spawnSync("bun", ["run", "build"], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, TURBO_FORCE: "true" },
});
assert(
  existsSync(appJs),
  `bun run build did not emit apps/api/dist/app.js${build.stderr ? `\n${build.stderr.trim()}` : ""}`,
);

// tsc exits non-zero on the 50 pre-existing TS2345 errors, so the build
// script's `&& tsx verify --rewrite` tail never runs and the emitted JS keeps
// its @/ aliases. Apply that same rewrite explicitly so the separately-run
// `verify:production` validates a real artifact (including /health and /ready
// in the compiled OpenAPI document) instead of an unrewritten one.
const rewrite = spawnSync(
  "bun",
  ["run", "--cwd", "apps/api", "verify:production", "--", "--rewrite"],
  { cwd: root, encoding: "utf8" },
);
assert(rewrite.status === 0, `alias rewrite / production verification failed:\n${rewrite.stdout}${rewrite.stderr}`);

console.log("PASS: build config verification succeeded");
console.log("  - CI workflow at root is bun-based (frozen lockfile, setup-bun, Bun store cached via actions/cache, no npm ci / cache: bun)");
console.log("  - Prisma/guards run through workspace/turbo scripts; .jest-cache kept");
console.log("  - single bun.lock; Docker contexts parametrized to apps/api; cms slot documented");
console.log("  - bun run build emitted apps/api/dist/app.js (aliases rewritten, artifact verified)");
